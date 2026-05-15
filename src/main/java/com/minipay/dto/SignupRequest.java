package com.minipay.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SignupRequest(

        @NotBlank(message = "이메일은 필수입니다")
        @Email(message = "이메일 형식이 올바르지 않습니다")
        String email,

        @NotBlank(message = "비밀번호는 필수입니다")
        @Size(min = 8, message = "비밀번호는 8자 이상이어야 합니다")
        @Pattern(
                regexp = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z\\d]).+$",
                message = "비밀번호는 영문/숫자/특수문자를 모두 포함해야 합니다"
        )
        String password,

        @NotBlank(message = "이름은 필수입니다")
        @Size(max = 100, message = "이름은 100자 이하여야 합니다")
        String name,

        @NotBlank(message = "PIN은 필수입니다")
        @Pattern(regexp = "^\\d{4}$", message = "PIN은 숫자 4자리여야 합니다")
        String pin
) {
}
