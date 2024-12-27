from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
import PyPDF2
import os
import json
import typing_extensions as typing

app = Flask(__name__)

# Configure Generative AI
genai.configure(api_key="api_key")
model = genai.GenerativeModel("gemini-1.5-flash")
chat = model.start_chat(
    history=[
        {"role": "user", "parts": "Hello"},
        {"role": "model", "parts": "Great to meet you. What would you like to know?"},
    ]
)


# Define schema for evaluation response
class EvalSchema(typing.TypedDict):
    Score: int
    grammar_suggestion: str
    Overall_assessment: str
    To_improve_answer: str


generated_question = "Tell me about yourself."
resume_text=""" """


def extract_text_from_pdf(file_path):
    try:
        with open(file_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            print(' '.join(page.extract_text() for page in reader.pages).strip())
            return ' '.join(page.extract_text() for page in reader.pages).strip()
    except Exception as e:
        raise ValueError(f"PDF extraction error: {e}")


def generate_prompt(job_role, resume, question_range):
    if question_range == 'core_skills':
        prompt = (
                    f"Generate a precise and concise interview question based on the core skills required for the job role: {job_role}. " +
                    "Keep questions technical and focused solely on core skills.")
    elif question_range == 'resume_based':
        prompt = (
                    f"Generate a precise and concise interview question based on the job role: {job_role} and resume insights: {resume}. " +
                    "Combine resume insights to ask about user's experience and contributions.")
    else:  # general questions
        prompt = (
                    f"Generate a precise and concise interview question focusing on company-specific scenarios, personal improvement, " +
                    f"and team collaboration for the job role: {job_role}.")

    print("Complete prompt:", prompt)
    return prompt
@app.route('/')
def index():
    return render_template('home.html')


@app.route('/chatbot')
def chatbot():
    return render_template('chatbot.html')


@app.route('/upload_resume', methods=['POST'])
def upload_resume():
    global resume_text
    if 'resume' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['resume']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    file_path = os.path.join("uploads", file.filename)
    file.save(file_path)

    try:
        text = extract_text_from_pdf(file_path)
        resume_text=text
        return jsonify({"text": text}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 500


@app.route('/ask_personal_question', methods=['POST'])
def ask_personal_question():
    response_text = request.json.get('user_response', '').strip()
    if not response_text:
        return jsonify({
            "Score": 0,
            "grammar_suggestion": "No response provided.",
            "Overall_assessment": "N/A",
            "To_improve_answer": "Please provide a response."
        }), 200

    eval_prompt = (
        f"Question: Tell me about yourself.\n"
        f"User's Answer: {response_text}\n"
        "Evaluate the response with a score out of 10, grammar suggestions, and improvement tips."
    )

    try:
        response = chat.send_message(eval_prompt, generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=EvalSchema
        ))
        feedback = json.loads(response.text)
        return jsonify(feedback), 200
    except Exception as e:
        return jsonify({
            "Score": 0,
            "grammar_suggestion": "Error processing response.",
            "Overall_assessment": "Unable to evaluate.",
            "To_improve_answer": str(e)
        }), 500


@app.route('/generate_question', methods=['POST'])
def generate_question():
    global generated_question
    global resume_text
    data = request.json
    print("data:", data)
    print("resume text:\n",resume_text)
    prompt = generate_prompt(
        data.get('job_role', ''),
        resume_text,
        data.get('question_range', '')
    )
    print("prompt:", prompt)

    try:
        response = chat.send_message(prompt)
        generated_question = response.text.strip()
        print("generated question:", generated_question)
        return jsonify({"question": generated_question}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to generate question: {str(e)}"}), 500


@app.route('/evaluate_response', methods=['POST'])
def evaluate_response():
    global generated_question
    response_text = request.json.get('user_response', '').strip()

    if not response_text or not generated_question:
        return jsonify({"error": "Missing data"}), 400

    evaluation_prompt = (
        f"Question: {generated_question}\n"
        f"User's Answer: {response_text}\n"
        f"Evaluate the user's answer and provide a score out of 10 with feedback. like score:'score'"
        f"Include suggestions for grammar improvement if needed, along with an overall assessment. like grammar suggestion:'suggestions'"
    )

    try:
        response = chat.send_message(evaluation_prompt, generation_config=genai.GenerationConfig(
            response_mime_type="application/json", response_schema=EvalSchema
        ), )
        feedback = json.loads(response.text)
        print("feedback:", feedback)
        return jsonify(feedback), 200
    except Exception as e:
        return jsonify({
            "Score": 0,
            "grammar_suggestion": "Error processing response.",
            "Overall_assessment": "Unable to evaluate.",
            "To_improve_answer": str(e)
        }), 500


if __name__ == '__main__':
    os.makedirs('uploads', exist_ok=True)
    app.run(debug=True)
