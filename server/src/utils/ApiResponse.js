class ApiResponse {
  constructor(data, message="Success", statusCode) {
    this.data = data;
    this.message = message;
    this.statusCode = statusCode;
    this.success = statusCode >= 200 && statusCode < 300;
  }
}

export {ApiResponse}