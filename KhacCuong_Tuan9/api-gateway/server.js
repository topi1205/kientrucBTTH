const express = require("express");
const axios = require("axios");
const rateLimit = require("express-rate-limit");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

// Tạo Express app
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Cấu hình Rate Limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 10, // Giới hạn 10 yêu cầu mỗi phút
  message: "Too many requests from this IP, please try again after a minute.",
});
app.use(limiter);

// Đường dẫn file lưu trạng thái Circuit Breaker
const CIRCUIT_BREAKER_STATE_FILE = path.join(
  __dirname,
  "circuit-breaker-state.json"
);

// Cấu hình Circuit Breaker mặc định
const DEFAULT_CIRCUIT_BREAKERS = {
  "payment-service": {
    failures: 0,
    threshold: 5,
    state: "CLOSED",
    lastFailure: null,
    resetTimeout: 10000,
  },
  "inventory-service": {
    failures: 0,
    threshold: 5,
    state: "CLOSED",
    lastFailure: null,
    resetTimeout: 10000,
  },
  "shipping-service": {
    failures: 0,
    threshold: 5,
    state: "CLOSED",
    lastFailure: null,
    resetTimeout: 10000,
  },
};

// Tải trạng thái Circuit Breaker từ file (nếu có)
function loadCircuitBreakerState() {
  try {
    if (fs.existsSync(CIRCUIT_BREAKER_STATE_FILE)) {
      const data = fs.readFileSync(CIRCUIT_BREAKER_STATE_FILE);
      const state = JSON.parse(data);
      console.log(
        `[${new Date().toISOString()}] Loaded Circuit Breaker state from file`
      );
      return state;
    }
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error loading Circuit Breaker state:`,
      error.message
    );
  }
  return DEFAULT_CIRCUIT_BREAKERS;
}

// Lưu trạng thái Circuit Breaker xuống file
function saveCircuitBreakerState(state) {
  try {
    fs.writeFileSync(
      CIRCUIT_BREAKER_STATE_FILE,
      JSON.stringify(state, null, 2)
    );
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error saving Circuit Breaker state:`,
      error.message
    );
  }
}

// Khởi tạo Circuit Breaker từ file hoặc giá trị mặc định
const circuitBreakers = loadCircuitBreakerState();

// Hàm gửi yêu cầu HTTP không có retry tự động
const sendRequest = async (method, url, data = null, timeout = 5000) => {
  try {
    console.log(
      `[${new Date().toISOString()}] Sending ${method} request to: ${url}`
    );

    const config = {
      method,
      url,
      timeout,
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    console.log(
      `[${new Date().toISOString()}] Received response with status: ${
        response.status
      }`
    );
    return response.data;
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Request failed: ${error.message}`
    );
    throw error;
  }
};

// Hàm khởi động lại service
const restartService = async (serviceName) => {
  console.log(
    `[${new Date().toISOString()}] Attempting to restart service: ${serviceName}`
  );

  return new Promise((resolve, reject) => {
    exec(`docker-compose up -d ${serviceName}`, (error, stdout, stderr) => {
      if (error) {
        console.error(
          `[${new Date().toISOString()}] Failed to restart ${serviceName}: ${stderr}`
        );
        return reject(new Error(`Failed to restart service: ${error.message}`));
      }

      console.log(
        `[${new Date().toISOString()}] ${serviceName} restart command executed. Waiting for service to be ready...`
      );
      // Chờ đợi service khởi động
      setTimeout(() => resolve(true), 30000); // Chờ 30 giây
    });
  });
};

// Hàm kiểm tra kết nối đến service
const checkServiceReady = async (serviceName, port) => {
  const url = `http://${serviceName}:${port}/health`;
  console.log(
    `[${new Date().toISOString()}] Checking if ${serviceName} is ready at ${url}`
  );

  try {
    await axios.get(url, { timeout: 5000 });
    console.log(
      `[${new Date().toISOString()}] Service ${serviceName} is ready`
    );
    return true;
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Service ${serviceName} is not ready: ${
        error.message
      }`
    );
    return false;
  }
};

// Hàm kiểm tra Circuit Breaker trước khi gọi service
const checkCircuitBreaker = (serviceName) => {
  const breaker = circuitBreakers[serviceName];
  if (!breaker) {
    return true; // Nếu không có circuit breaker cho service này, cho phép gọi
  }

  const now = Date.now();

  // Trường hợp OPEN: kiểm tra xem đã đến thời gian reset chưa
  if (breaker.state === "OPEN") {
    // Nếu đã đủ thời gian reset, chuyển sang HALF_OPEN
    if (now - breaker.lastFailure >= breaker.resetTimeout) {
      console.log(
        `[${new Date().toISOString()}] Circuit Breaker for ${serviceName} changed from OPEN to HALF_OPEN`
      );
      breaker.state = "HALF_OPEN";
      saveCircuitBreakerState(circuitBreakers); // Lưu lại trạng thái
    } else {
      // Chưa đủ thời gian reset, vẫn ở trạng thái OPEN
      console.log(
        `[${new Date().toISOString()}] Circuit Breaker for ${serviceName} is OPEN. Request rejected.`
      );
      return false;
    }
  }

  return true;
};

// Hàm cập nhật Circuit Breaker khi gọi service thành công
const recordSuccess = (serviceName) => {
  const breaker = circuitBreakers[serviceName];
  if (!breaker) return;

  // Nếu thành công và đang ở trạng thái HALF_OPEN, chuyển về CLOSED
  if (breaker.state === "HALF_OPEN") {
    console.log(
      `[${new Date().toISOString()}] Circuit Breaker for ${serviceName} changed from HALF_OPEN to CLOSED`
    );
    breaker.state = "CLOSED";
  }

  // Reset số lần lỗi
  breaker.failures = 0;

  // Lưu lại trạng thái
  saveCircuitBreakerState(circuitBreakers);
};

// Hàm cập nhật Circuit Breaker khi gọi service thất bại
const recordFailure = (serviceName) => {
  const breaker = circuitBreakers[serviceName];
  if (!breaker) return;

  breaker.failures++;
  breaker.lastFailure = Date.now();

  console.log(
    `[${new Date().toISOString()}] Failure recorded for ${serviceName}. Total failures: ${
      breaker.failures
    }/${breaker.threshold}`
  );

  // Nếu số lần lỗi đạt ngưỡng, chuyển sang trạng thái OPEN
  if (breaker.failures >= breaker.threshold) {
    console.log(
      `[${new Date().toISOString()}] Circuit Breaker for ${serviceName} changed to OPEN`
    );
    breaker.state = "OPEN";
  }

  // Lưu lại trạng thái
  saveCircuitBreakerState(circuitBreakers);
};

// Lần retry Maximum
const MAX_RETRY_ATTEMPTS = 5;

// Hàm gọi service với Circuit Breaker và khả năng khởi động lại
const callServiceWithCircuitBreaker = async (
  serviceName,
  port,
  path,
  method,
  data = null,
  retryCount = MAX_RETRY_ATTEMPTS,
  retryDelay = 10000
) => {
  // Kiểm tra Circuit Breaker trước
  if (!checkCircuitBreaker(serviceName)) {
    throw new Error(`Circuit Breaker for ${serviceName} is OPEN`);
  }

  const url = `http://${serviceName}:${port}${path}`;

  try {
    // Thử gọi service
    const result = await sendRequest(method, url, data);
    // Ghi nhận thành công
    recordSuccess(serviceName);
    return result;
  } catch (error) {
    // Ghi nhận lỗi
    recordFailure(serviceName);

    console.log(
      `[${new Date().toISOString()}] Call to ${serviceName} failed. Starting recovery process.`
    );

    // Nếu Circuit Breaker mở sau lỗi này, throw error ngay
    if (circuitBreakers[serviceName].state === "OPEN") {
      throw new Error(`Circuit Breaker for ${serviceName} is OPEN`);
    }

    // Khởi động lại service
    try {
      await restartService(serviceName);
    } catch (restartError) {
      console.error(
        `[${new Date().toISOString()}] Service restart failed: ${
          restartError.message
        }`
      );
      // Tiếp tục với retry ngay cả khi restart thất bại
    }

    // Thực hiện retry với kiểm tra trạng thái service
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      // Kiểm tra Circuit Breaker trước mỗi lần retry
      if (!checkCircuitBreaker(serviceName)) {
        throw new Error(`Circuit Breaker for ${serviceName} is OPEN`);
      }

      console.log(
        `[${new Date().toISOString()}] Retry attempt ${attempt}/${retryCount} for ${serviceName}`
      );

      // Kiểm tra xem service đã sẵn sàng chưa
      let isReady = false;
      try {
        isReady = await checkServiceReady(serviceName, port);
      } catch (checkError) {
        console.error(
          `[${new Date().toISOString()}] Error checking service readiness: ${
            checkError.message
          }`
        );
      }

      if (isReady) {
        console.log(
          `[${new Date().toISOString()}] Service ${serviceName} is ready. Retrying request.`
        );
        try {
          const result = await sendRequest(method, url, data);
          // Ghi nhận thành công
          recordSuccess(serviceName);
          return result;
        } catch (retryError) {
          // Ghi nhận lỗi
          recordFailure(serviceName);

          console.error(
            `[${new Date().toISOString()}] Retry attempt ${attempt} failed: ${
              retryError.message
            }`
          );

          // Nếu Circuit Breaker mở sau lỗi này, throw error ngay
          if (circuitBreakers[serviceName].state === "OPEN") {
            throw new Error(`Circuit Breaker for ${serviceName} is OPEN`);
          }

          if (attempt === retryCount) {
            throw new Error(
              `All ${retryCount} retry attempts failed for ${serviceName}`
            );
          }
        }
      }

      // Nếu service chưa sẵn sàng và còn lần retry, chờ đợi
      if (attempt < retryCount) {
        console.log(
          `[${new Date().toISOString()}] Service ${serviceName} not ready. Waiting ${
            retryDelay / 1000
          }s before retry ${attempt + 1}/${retryCount}`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        throw new Error(
          `Service ${serviceName} is not ready after ${retryCount} attempts`
        );
      }
    }
  }
};

// API endpoint để xử lý đơn hàng
app.post("/order", async (req, res) => {
  try {
    console.log(
      `[${new Date().toISOString()}] Processing order with data:`,
      req.body
    );

    // Gọi Payment Service với Circuit Breaker
    const paymentResponse = await callServiceWithCircuitBreaker(
      "payment-service",
      3001,
      "/api/payment/pay",
      "post",
      req.body
    );

    // Gọi Inventory Service với Circuit Breaker
    const inventoryResponse = await callServiceWithCircuitBreaker(
      "inventory-service",
      3002,
      "/api/inventory/update",
      "post",
      {
        productId: req.body.productId || "12345",
        quantity: req.body.quantity || 2,
      }
    );

    // Gọi Shipping Service với Circuit Breaker
    const shippingResponse = await callServiceWithCircuitBreaker(
      "shipping-service",
      3003,
      "/api/shipping",
      "post",
      { orderId: "123", address: req.body.address || "Hanoi" }
    );

    res.status(200).send({
      message: "Order processed successfully",
      paymentStatus: paymentResponse,
      inventoryStatus: inventoryResponse,
      shippingStatus: shippingResponse,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Failed to process order:`,
      error.message
    );

    // Nếu lỗi là do Circuit Breaker mở
    if (
      error.message.includes("Circuit Breaker") &&
      error.message.includes("OPEN")
    ) {
      return res.status(503).send({
        success: false,
        message: "Service temporarily unavailable. Circuit Breaker is OPEN.",
        error: error.message,
      });
    }

    res.status(500).send({
      success: false,
      message: "Error processing order. Please try again later.",
      error: error.message,
    });
  }
});

// API endpoint cơ bản để kiểm tra kết nối
app.get("/", (req, res) => {
  res.status(200).json({
    message: "API Gateway is running",
    timestamp: new Date().toISOString(),
  });
});

// API endpoint để lấy trạng thái của Circuit Breaker - đơn giản hóa đường dẫn
app.get("/status", (req, res) => {
  console.log(`[${new Date().toISOString()}] GET request to /status`);
  res.status(200).json(circuitBreakers);
});

// API endpoint để lấy trạng thái của Circuit Breaker - đường dẫn đầy đủ
app.get("/circuit-breaker/status", (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET request to /circuit-breaker/status`
  );
  res.status(200).json(circuitBreakers);
});

// Endpoint để reset Circuit Breaker
app.post("/circuit-breaker/reset", (req, res) => {
  const { service } = req.body;
  console.log(
    `[${new Date().toISOString()}] POST request to /circuit-breaker/reset for service: ${service}`
  );

  if (!service || !circuitBreakers[service]) {
    return res.status(400).json({ message: "Invalid service name" });
  }

  circuitBreakers[service].failures = 0;
  circuitBreakers[service].state = "CLOSED";
  circuitBreakers[service].lastFailure = null;

  // Lưu lại trạng thái
  saveCircuitBreakerState(circuitBreakers);

  console.log(
    `[${new Date().toISOString()}] Circuit Breaker for ${service} has been manually reset`
  );

  res.status(200).json({
    success: true,
    message: `Circuit Breaker for ${service} has been reset`,
    status: circuitBreakers[service],
  });
});

// Lắng nghe trên cổng
const server = app.listen(PORT, () => {
  console.log(
    `[${new Date().toISOString()}] API Gateway running on port ${PORT}`
  );
});

// Xử lý graceful shutdown
process.on("SIGTERM", () => {
  console.log(
    "[${new Date().toISOString()}] SIGTERM signal received: closing HTTP server"
  );
  server.close(() => {
    console.log("[${new Date().toISOString()}] HTTP server closed");
    // Lưu trạng thái Circuit Breaker trước khi tắt
    saveCircuitBreakerState(circuitBreakers);
  });
});
