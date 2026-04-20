class ApiResponse {
  constructor(statusCode, data, message = "Success") {
    this.success = statusCode >= 200 && statusCode < 300;
    this.data = data;
    this.message = message;
  }
}

export default ApiResponse;
