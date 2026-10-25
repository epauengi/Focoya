package com.lofi.studyroombackend.service;

import com.lofi.studyroombackend.dto.request.UpdateProfileRequest;
import com.lofi.studyroombackend.dto.response.PublicUserResponse;
import com.lofi.studyroombackend.dto.response.UserProfileResponse;

import java.util.UUID;

public interface UserService {

    UserProfileResponse getMyProfile(UUID currentUserId);

    UserProfileResponse updateMyProfile(UUID currentUserId, UpdateProfileRequest request);

    PublicUserResponse getPublicProfile(UUID userId);
}
