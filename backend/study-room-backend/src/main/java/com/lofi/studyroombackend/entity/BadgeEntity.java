package com.lofi.studyroombackend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "badges")
@Getter
@Setter
@NoArgsConstructor
public class BadgeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Mã cố định để code tra cứu, ví dụ FIRST_STEP, ON_FIRE.
    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 255)
    private String description;

    @Column(name = "icon_key", length = 50)
    private String iconKey;

    @Column(name = "condition_type", nullable = false, length = 50)
    private String conditionType;

    @Column(name = "condition_value", nullable = false)
    private int conditionValue;
}
