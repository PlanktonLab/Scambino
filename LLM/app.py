import subprocess
import os
from pathlib import Path
from flask import Flask, request, jsonify, Response
import threading
import json

# --- Configuration ---
# Set the absolute path to your genie_bundle directory.
GENIE_BUNDLE_PATH = Path(r"C:\Users\WoS_user\Documents\QualcommProject\genie_bundle")
EXECUTABLE_NAME = "genie-t2t-run.exe"
SYSTEM_PROMPT_FILE = "system_prompt.txt"

# --- Flask App Initialization ---
app = Flask(__name__)

# --- Global variable to hold the system prompt and a lock for thread safety ---
SYSTEM_PROMPT = ""
inference_lock = threading.Lock() # Prevents multiple requests from running inference simultaneously

def load_system_prompt() -> str:
    """Loads the system prompt from the specified text file."""
    try:
        with open(SYSTEM_PROMPT_FILE, "r", encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        print(f"Warning: '{SYSTEM_PROMPT_FILE}' not found. Using a default system prompt.")
        return "你是一個來自台灣的AI助理，你的名字是 TAIDE。"

def format_taide_prompt(user_prompt: str, system_prompt: str) -> str:
    """Formats the prompts into the full string required by the TAIDE model."""
    return (
        f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n"
        f"{system_prompt}<|eot_id|>\n"
        f"<|start_header_id|>user<|end_header_id|>\n\n"
        f"{user_prompt}<|eot_id|>\n"
        f"<|start_header_id|>assistant<|end_header_id|>"
    )

def parse_genie_output(raw_output: str) -> str:
    """Parses the raw output from genie-t2t-run.exe to extract the clean AI response."""
    try:
        after_begin = raw_output.split("[BEGIN]:", 1)[1]
        clean_response = after_begin.split("[END]", 1)[0]
        return clean_response.strip()
    except IndexError:
        print(f"\n--- Error: Could not parse model output. Raw output was: ---\n{raw_output}\n--------------------")
        return ""

def run_inference(user_prompt: str, system_prompt_override: str = None) -> str:
    """
    Runs the TAIDE model inference. This is a blocking call for the standard API.
    """
    executable_path = GENIE_BUNDLE_PATH / EXECUTABLE_NAME
    if not executable_path.is_file():
        return "Error: Inference executable not found."

    current_system_prompt = system_prompt_override if system_prompt_override else load_system_prompt()
    
    # New: Log request details
    print("\n[INFO] /generate (blocking) request received.")
    print(f"  > System Prompt: '{current_system_prompt[:70]}...'")
    print(f"  > User Question: '{user_prompt}'")
    
    full_prompt = format_taide_prompt(user_prompt, current_system_prompt)
    prompt_file_path = GENIE_BUNDLE_PATH / "api_prompt.txt"

    try:
        with open(prompt_file_path, "w", encoding="utf-8") as f:
            f.write(full_prompt)

        command = [
            str(executable_path),
            "-c", "genie_config.json",
            "--prompt_file", str(prompt_file_path)
        ]

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            cwd=GENIE_BUNDLE_PATH
        )

        if result.returncode != 0:
            print(f"Error running genie-t2t-run.exe. Stderr:\n{result.stderr}")
            return f"Inference process failed. Error: {result.stderr}"
        
        parsed_response = parse_genie_output(result.stdout)
        # New: Log the full model output
        print("  > Full Model Output:")
        print("------------------------------------")
        print(parsed_response)
        print("------------------------------------")
        return parsed_response

    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return f"An unexpected server error occurred: {e}"
    finally:
        if os.path.exists(prompt_file_path):
            os.remove(prompt_file_path)

def run_inference_streaming_generator(user_prompt: str, system_prompt_override: str = None):
    """
    A generator function that runs the inference and yields output line by line for streaming.
    This version has improved parsing logic and prints output to the server console.
    """
    executable_path = GENIE_BUNDLE_PATH / EXECUTABLE_NAME
    if not executable_path.is_file():
        yield f"data: {json.dumps({'error': 'Inference executable not found.'})}\n\n"
        return

    current_system_prompt = system_prompt_override if system_prompt_override else load_system_prompt()
    
    # New: Log request details
    print("\n[INFO] /generate-stream (streaming) request received.")
    print(f"  > System Prompt: '{current_system_prompt[:70]}...'")
    print(f"  > User Question: '{user_prompt}'")
    print("  > Streaming Model Output:")
    print("------------------------------------")
    
    full_prompt = format_taide_prompt(user_prompt, current_system_prompt)
    prompt_file_path = GENIE_BUNDLE_PATH / "api_stream_prompt.txt"

    try:
        with open(prompt_file_path, "w", encoding="utf-8") as f:
            f.write(full_prompt)

        command = [
            str(executable_path),
            "-c", "genie_config.json",
            "--prompt_file", str(prompt_file_path)
        ]

        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=GENIE_BUNDLE_PATH,
            bufsize=1
        )

        streaming_started = False
        full_response_for_log = []
        for line_bytes in process.stdout:
            line_str = line_bytes.decode('utf-8', errors='replace')
            
            if streaming_started:
                if "[END]" in line_str:
                    content_before_end = line_str.split("[END]", 1)[0]
                    if content_before_end:
                         print(content_before_end, end='', flush=True)
                         full_response_for_log.append(content_before_end)
                         yield f"data: {json.dumps({'token': content_before_end})}\n\n"
                    break
                else:
                    print(line_str, end='', flush=True)
                    full_response_for_log.append(line_str)
                    yield f"data: {json.dumps({'token': line_str})}\n\n"
            elif "[BEGIN]:" in line_str:
                streaming_started = True
                content_after_begin = line_str.split("[BEGIN]:", 1)[1]
                if "[END]" in content_after_begin:
                    final_content = content_after_begin.split("[END]", 1)[0]
                    if final_content:
                        print(final_content, end='', flush=True)
                        full_response_for_log.append(final_content)
                        yield f"data: {json.dumps({'token': final_content})}\n\n"
                    break
                else:
                    if content_after_begin:
                        print(content_after_begin, end='', flush=True)
                        full_response_for_log.append(content_after_begin)
                        yield f"data: {json.dumps({'token': content_after_begin})}\n\n"
        
        print("\n------------------------------------") # Footer for the stream log

        process.wait()
        if process.returncode != 0:
            stderr_bytes = process.stderr.read()
            stderr_output = stderr_bytes.decode('utf-8', errors='replace')
            print(f"\nError in streaming inference. Stderr:\n{stderr_output}")
            yield f"data: {json.dumps({'error': f'Inference process failed: {stderr_output}'})}\n\n"

    except Exception as e:
        print(f"An unexpected error occurred during streaming: {e}")
        yield f"data: {json.dumps({'error': f'An unexpected server error occurred: {e}'})}\n\n"
    finally:
        if os.path.exists(prompt_file_path):
            os.remove(prompt_file_path)
        yield f"data: {json.dumps({'event': 'done'})}\n\n"

@app.route('/generate', methods=['POST'])
def generate_response():
    """API endpoint to generate a full response from the LLM."""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()
    question = data.get('question')
    system_prompt_override = data.get('system_prompt')

    if not question:
        return jsonify({"error": "Missing 'question' in request body"}), 400

    with inference_lock:
        response = run_inference(question, system_prompt_override)

    if "Error:" in response or "failed" in response:
        return jsonify({"error": response}), 500

    return jsonify({"response": response})


@app.route('/generate-stream', methods=['POST'])
def generate_stream():
    """API endpoint that streams the LLM response."""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()
    question = data.get('question')
    system_prompt_override = data.get('system_prompt') 

    if not question:
        return jsonify({"error": "Missing 'question' in request body"}), 400
    
    if not inference_lock.acquire(blocking=False):
        error_event = f"data: {json.dumps({'error': 'Inference engine is busy. Please try again later.'})}\n\n"
        return Response(error_event, mimetype='text/event-stream')

    def stream_with_lock():
        try:
            yield from run_inference_streaming_generator(question, system_prompt_override)
        finally:
            inference_lock.release()

    return Response(stream_with_lock(), mimetype='text/event-stream')

if __name__ == "__main__":
    SYSTEM_PROMPT = load_system_prompt()
    print(f"Flask server starting...")
    print(f"Initial System Prompt loaded: '{SYSTEM_PROMPT[:70]}...'")
    app.run(debug=False, host='0.0.0.0', port=5000)

