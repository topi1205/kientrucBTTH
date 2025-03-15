from flask import Flask
app = Flask(__name__)

@app.route('/')
def hello_world():
    return "Hello, Docker Flask!"

# Chạy ứng dụng Flask
if __name__ == '__main__':
    # Chạy trên host '0.0.0.0' để cho phép truy cập từ ngoài container
    app.run(host='0.0.0.0', port=5000, debug=True)
