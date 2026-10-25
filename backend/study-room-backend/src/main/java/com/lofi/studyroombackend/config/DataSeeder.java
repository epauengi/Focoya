package com.lofi.studyroombackend.config;

import com.lofi.studyroombackend.entity.RoomEntity;
import com.lofi.studyroombackend.entity.enums.RoomVisibility;
import com.lofi.studyroombackend.repository.RoomRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

// Nạp dữ liệu mẫu mỗi lần app khởi động (CommandLineRunner: Spring gọi run() sau khi app khởi động xong).
// Không có Flyway nên seed bằng code. Mỗi dòng đều kiểm tra "đã có chưa" -> restart bao nhiêu lần cũng không trùng.
// Seed badge (TSK-26) có thể thêm vào đây.
@Component
public class DataSeeder implements CommandLineRunner {

    private final RoomRepository roomRepository;

    public DataSeeder(RoomRepository roomRepository) {
        this.roomRepository = roomRepository;
    }

    @Override
    public void run(String... args) {
        // Phòng public lấy đúng theo mock ROOMS của FE (frontend/src/features/rooms/rooms.ts), nhóm chốt FE làm chuẩn.
        seedPublicRoom("Cozy Café", "Café", 16, "/room-assets/rainy.jpg",
                "Một góc quán cà phê ấm cúng với tiếng nhạc jazz êm dịu và hương cà phê thơm ngát.");
        seedPublicRoom("Sakura Garden", "Nature", 12, "/room-assets/autumn.png",
                "Cánh hoa anh đào rơi nhẹ trên con đường vắng lặng. Thanh bình và thư thái.");
        seedPublicRoom("Space Station", "Gaming", 24, "/room-assets/midnight.png",
                "Trạm vũ trụ trong màn đêm tĩnh mịch, không gian lý tưởng cho các game thủ tập trung.");
        seedPublicRoom("Study Corner", "Study", 10, "/room-assets/rainy.jpg",
                "Bàn học ngăn nắp với ánh đèn vàng dịu nhẹ, thích hợp cho những buổi học sâu.");
        seedPublicRoom("Sunset Lounge", "Chill", 20, "/room-assets/sunset.jpg",
                "Bầu trời hoàng hôn rực rỡ, những giai điệu lo-fi chill và những câu chuyện nhẹ nhàng.");
        seedPublicRoom("Forest Hideaway", "Nature", 10, "/room-assets/autumn.png",
                "Một căn nhà gỗ nhỏ ẩn mình giữa rừng cây lá đỏ mùa thu yên tĩnh.");
    }

    private void seedPublicRoom(String name, String theme, int maxSlots, String image, String description) {
        // Đã có phòng public trùng tên -> bỏ qua.
        if (roomRepository.existsByNameAndVisibility(name, RoomVisibility.PUBLIC)) {
            return;
        }

        // Phòng public: không có chủ (owner = null), không có mã mời -> khớp CHECK chk_rooms_private_fields.
        RoomEntity room = new RoomEntity();
        room.setName(name);
        room.setThemeKey(theme);
        room.setSceneKey(image);
        room.setDescription(description);
        room.setMaxSlots(maxSlots);
        room.setVisibility(RoomVisibility.PUBLIC);
        roomRepository.save(room);
    }
}
