package com.lofi.studyroombackend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

// Body của PUT /api/users/me. PUT = gửi lại ĐỦ 3 field: field nào bỏ trống (bio, avatarKey) thì bị xóa thành null.
// Không có email, password, role, xp: những thứ này không cho user tự sửa qua API này.
@Getter
@Setter
public class UpdateProfileRequest {

    // Excel TSK-09: tên hiển thị 2–50 ký tự (giống lúc đăng ký).
    @NotBlank(message = "Tên hiển thị không được để trống")
    @Size(min = 2, max = 50, message = "Tên hiển thị phải từ 2 đến 50 ký tự")
    private String displayName;

    // Excel TSK-09: bio tối đa 200 ký tự (khớp cột bio length = 200).
    @Size(max = 200, message = "Bio tối đa 200 ký tự")
    private String bio;

    // Mã avatar mặc định của Focoya (FE TSK-15 có 8 avatar), ví dụ "avatar-3".
    @Size(max = 50, message = "Mã avatar tối đa 50 ký tự")
    private String avatarKey;
}
