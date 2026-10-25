package com.lofi.studyroombackend.exception;

import com.lofi.studyroombackend.dto.response.ErrorResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

// Bắt exception ném ra từ MỌI controller/service và đổi thành JSON ErrorResponse.
// Bản tối thiểu cho TSK-06. Bản đầy đủ (404, 403, 500...) làm ở TSK-33.
@RestControllerAdvice
public class GlobalExceptionHandler {

    // Lỗi do mình chủ động ném trong service: throw new ResponseStatusException(HttpStatus.CONFLICT, "...")
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleResponseStatus(ResponseStatusException ex) {
        int status = ex.getStatusCode().value();
        ErrorResponse body = new ErrorResponse(status, ex.getReason());
        return ResponseEntity.status(status).body(body);
    }

    // Lỗi validate từ @Valid (ví dụ mật khẩu thiếu chữ số). Trả về message của lỗi đầu tiên.
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        FieldError firstError = ex.getBindingResult().getFieldErrors().get(0);
        ErrorResponse body = new ErrorResponse(400, firstError.getDefaultMessage());
        return ResponseEntity.status(400).body(body);
    }

    // Body không phải JSON hợp lệ (thiếu dấu ngoặc, sai kiểu dữ liệu...).
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleBadJson(HttpMessageNotReadableException ex) {
        ErrorResponse body = new ErrorResponse(400, "Dữ liệu gửi lên không đúng định dạng JSON");
        return ResponseEntity.status(400).body(body);
    }

    // Tham số trên URL sai kiểu, ví dụ GET /api/rooms/abc trong khi roomId phải là UUID.
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        ErrorResponse body = new ErrorResponse(400, "Tham số '" + ex.getName() + "' không hợp lệ");
        return ResponseEntity.status(400).body(body);
    }
}
