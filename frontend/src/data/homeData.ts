// Nội dung hiển thị cho landing page Focoya.

export interface TestimonialItem {
  name: string;
  title?: string;
  text: string;
  photo?: string;
}

export interface ColorScheme {
  bg: string;
  fg: string;
}

export const TESTIMONIAL_COLORS: ColorScheme[] = [
  { bg: "#DBEAFE", fg: "#1D4ED8" },
  { bg: "#DCFCE7", fg: "#15803D" },
  { bg: "#DFF7F4", fg: "#0F766E" },
  { bg: "#E0F2FE", fg: "#0369A1" },
  { bg: "#DCEEF7", fg: "#075985" },
  { bg: "#D1FAE5", fg: "#047857" },
  { bg: "#CCFBF1", fg: "#0F766E" },
  { bg: "#E0F7FA", fg: "#0E7490" },
];

export const TESTIMONIALS: TestimonialItem[] = [
  {
    name: "Sara Ferrarini",
    title: "Kỹ sư khai thác mỏ",
    text: "Tôi chưa từng dùng ứng dụng nào hữu ích đến vậy! Focoya giúp tôi tập trung khi cần hoàn thành công việc. Giao diện đẹp, yên bình và đơn giản. Tôi rất thích không gian thư thái mà ứng dụng mang lại.",
    photo: "/assets/images/9f0b0ed64ccab47dc2ba.webp"
  },
  {
    name: "Claire S.",
    text: "Tôi mắc ADHD và tự kỷ nên việc học khó khăn hơn nhiều. Nhờ hình nền, câu trích dẫn và âm nhạc, Focoya đã thay đổi hoàn toàn cách tôi học.",
    photo: "/assets/images/735f40ad8d6fc44eed92.webp"
  },
  {
    name: "Pragya P.",
    text: "Focoya đã trở thành công cụ không thể thiếu trong hành trình học tập của tôi. Giao diện thân thiện, thiết kế gọn gàng và bố cục trực quan giúp trải nghiệm luôn liền mạch, dễ chịu.",
    photo: "/assets/images/c8802b7fb3ffa75c2fc4.webp"
  },
  {
    name: "Grace",
    text: "Trước đây tôi khó quản lý thời gian. Focoya giúp tôi đi đúng kế hoạch và làm việc hiệu quả hơn. Điểm số của tôi cũng đang tốt lên!",
    photo: "/assets/images/05962d24398ab4feb553.webp"
  },
  {
    name: "Mayra N.",
    text: "Sau khi đọc cuốn Atomic Habits, tôi rất thích các chế độ trong ứng dụng. Tôi không thể đổi vị trí bàn, nhưng chuyển giữa chế độ ở nhà, không gian thư giãn và làm việc giúp tôi dễ vào đúng tâm trạng hơn."
  },
  {
    name: "Lucy H.",
    text: "Đồng hồ rất hữu ích, còn email hằng tuần với gợi ý và phương pháp tập trung cũng rất thiết thực. Tôi mừng vì đã tìm thấy Focoya!"
  },
  {
    name: "Brigs",
    text: "Tôi rất thích Focoya. Ứng dụng giúp việc học thư thái hơn, giữ tôi tập trung vào công việc và tránh xao nhãng. Tôi cũng chủ động chăm sóc bản thân và nghỉ ngơi đúng lúc hơn."
  },
  {
    name: "Miranda P.",
    text: "Không gian âm thanh tuyệt vời, phù hợp để tập trung hoặc đọc sách theo từng phiên. Là người mắc ADHD, tôi thực sự, thực sự yêu thích Focoya!"
  },
  {
    name: "Nishtha B.",
    text: "Focoya chưa được đánh giá đúng mức. Thiết kế tối giản và chỉn chu. Tôi thích chế độ tập trung và thư giãn nhất vì có thể tùy chỉnh đồng hồ và nghe âm thanh nền nhẹ nhàng.",
    photo: "/assets/images/01fca1456e929c4f9fb9.webp"
  },
  {
    name: "Kaila O.",
    text: "Ứng dụng thật thư thái và đơn giản nhưng vẫn có nhiều tùy chọn cá nhân hóa. Tôi hoàn thành được rất nhiều việc — đây chắc chắn là trang web không thể thiếu để tập trung.",
    photo: "/assets/images/9246d776e3270e0248f1.webp"
  },
  {
    name: "Zikra A.",
    text: "Focoya luôn khiến tôi bất ngờ — từ đồng hồ, câu trích dẫn đến âm thanh quán cà phê. Mọi thứ cần để tập trung đều có đủ.",
    photo: "/assets/images/3381118fb131130ecb7f.webp"
  },
  {
    name: "Rojan S.",
    text: "Thật lòng mà nói, Focoya là ứng dụng năng suất tốt nhất từng có. Tôi thích việc đồng hồ, âm thanh và âm nhạc đều ở cùng một nơi. Ứng dụng giúp tôi đạt toàn điểm A.",
    photo: "/assets/images/32e9361fc80827e28bfa.webp"
  },
  {
    name: "Haleema",
    text: "Tôi mê giao diện này ngay từ lần đầu. Bạn có thể tùy chỉnh Pomodoro, chọn giao diện và âm thanh nền. Cảm ơn Focoya."
  },
  {
    name: "Kairo K.",
    text: "Tôi thích thiền và học cùng Focoya. Đây là ứng dụng tuyệt vời để việc tập trung trở nên thú vị.",
    photo: "/assets/images/fba73df5019e5e740b62.webp"
  },
  {
    name: "Riya",
    text: "Thật khó tin là một ứng dụng tuyệt vời như vậy lại miễn phí! Đội ngũ phát triển đã làm rất tốt. Đây chính là mọi thứ tôi mong muốn. Cảm ơn các bạn!",
    photo: "/assets/images/8deaab3de0eeb0514d62.webp"
  },
  {
    name: "Mia H.",
    text: "Focoya thật tuyệt. Tôi rất thích hình nền và cách thiết kế đồng hồ. Nhờ Focoya, tôi đã đạt được điểm số tốt.",
    photo: "/assets/images/84f9b3c065699a70c437.webp"
  },
  {
    name: "Cathy B.",
    text: "Tôi thích trang web này. Hình nền rất dễ thương, âm thanh thư giãn và nhiều tùy chọn đồng hồ. Lúc nào tôi cũng mở trang trên máy tính.",
    photo: "/assets/images/a2aae2675b98b265fa5e.webp"
  },
  {
    name: "Cecília",
    text: "Focoya giúp tôi duy trì động lực và sự tập trung. Các công cụ có giao diện dễ chịu khiến việc học bớt căng thẳng hơn nhiều.",
    photo: "/assets/images/3a0c007a7f9f3bec705b.webp"
  },
  {
    name: "Noura",
    text: "Tôi cực kỳ yêu thích Focoya! Ứng dụng giúp tôi tập trung rất tốt và có nhiều tùy chọn cá nhân hóa. Tôi hoàn toàn đề xuất!",
    photo: "/assets/images/efe897a20caedbf823ab.webp"
  },
  {
    name: "Aadiya",
    text: "Ứng dụng giúp tôi tập trung hơn và hoàn thành công việc đúng hạn. Tôi có thể ôn thi và xử lý những phần bài vất vả mà không bị kiệt sức.",
    photo: "/assets/images/a84ee39eb23ed225bc50.webp"
  },
  {
    name: "Cleo",
    text: "YÊU QUÁ! Ước gì có người giới thiệu ứng dụng này cho tôi sớm hơn.",
    photo: "/assets/images/2053c2769d1947ba2492.webp"
  },
  {
    name: "JULIAAAAAA",
    text: "Tôi mắc ADHD và rất khó tập trung, nhưng ứng dụng này giúp tôi tập trung tốt hơn nhiều. Âm nhạc, giao diện, đồng hồ — mọi thứ đều tuyệt! Rất đáng thử."
  },
  {
    name: "Lauren D.",
    text: "Tôi thích vì ứng dụng giúp mình tập trung và có giao diện rất đẹp. Xin gửi lời khen đến bất cứ ai đã tạo ra nó.",
    photo: "/assets/images/a5fff40ca5e28e85dc99.webp"
  },
  {
    name: "Lex A.",
    text: "Focoya đã giúp tôi tập trung suốt một tuần qua. Bắt đầu phiên học rất nhanh, giúp tôi dễ dàng nhập tâm.",
    photo: "/assets/images/5326d4a1287f6efcfd04.webp"
  },
  {
    name: "Strawberry",
    text: "Trời ơi, ứng dụng này tốt thật! Tôi hoàn thành hết công việc trong khoảng 2 giờ nhờ Pomodoro, trong khi bình thường phải mất khoảng 5 giờ."
  },
  {
    name: "Aleena",
    text: "Âm thanh thư giãn và tích hợp Spotify là những tính năng tôi thích nhất. Giờ việc học thật sự rất vui."
  },
  {
    name: "Sophie",
    text: "Ứng dụng thật tuyệt! Nó giúp tôi quản lý thời gian tốt hơn. Tôi hoàn thành công việc và cuối cùng cũng tập trung được. Thiết kế trang web dễ thương quá, tôi rất vui vì đã tìm thấy Focoya!"
  },
  {
    name: "Tanya S.",
    text: "Focoya giúp tôi làm việc hiệu quả hơn. Tôi thích việc có thể đổi hình nền, đồng hồ và cả danh sách nhạc."
  },
  {
    name: "Allee",
    text: "Tôi tình cờ tìm thấy ứng dụng ngay trước lúc học và mê luôn. Ứng dụng khiến tôi muốn ngồi vào bàn học vì quá đẹp."
  },
  {
    name: "Mariah",
    text: "Một cách tập trung thật đẹp mắt. Hình nền đồng hồ dễ thương, đồ họa đáng yêu — rất đáng dùng."
  },
  {
    name: "Bella",
    text: "Focoya đúng là ứng dụng tuyệt nhất, nhất là nếu bạn yêu thích giao diện đẹp. Tôi thấy mình thật sự làm việc hiệu quả hơn khi dùng ứng dụng."
  },
  {
    name: "Emirhan",
    text: "Bạn biết cảm giác tìm thấy thứ mình chưa biết là rất cần không? Với tôi, đó chính là Focoya. Tôi dùng đồng hồ cho các phiên làm việc, còn giao diện nền thì đẹp mê."
  },
  {
    name: "Isabella",
    text: "Ứng dụng giúp tôi quản lý thời gian tốt hơn rất nhiều. Tôi nỗ lực nhiều hơn và cảm thấy mình làm việc hiệu quả.",
    photo: "/assets/images/d88291d635ff5599cadb.webp"
  },
  {
    name: "Kirsten",
    title: "Sinh viên",
    text: "Không gian với Focoya thật thư thái. Ứng dụng giúp việc ôn thi trở nên dễ chịu và thú vị hơn.",
    photo: "/assets/images/088eed4492d3d14fc127.webp"
  },
  {
    name: "Izzy",
    text: "Focoya giúp tôi làm việc hiệu quả hơn. Ứng dụng giúp tôi có trách nhiệm với bản thân vì tôi không muốn mất chuỗi ngày học liên tục."
  },
  {
    name: "Ziki",
    text: "Ứng dụng này đúng là viên ngọc quý! Thật tuyệt vời khi muốn tăng năng suất mà vẫn có giao diện đẹp.",
    photo: "/assets/images/342f569363ff86587f1d.webp"
  },
  {
    name: "Addi W.",
    text: "Tôi cảm thấy mình làm việc hiệu quả hơn, mà ứng dụng lại rất dễ thương. Tôi thích tính năng theo dõi chuỗi ngày học và hình nền hợp với mọi tâm trạng."
  },
  {
    name: "Irma N.",
    text: "Tôi thích trang web này. Âm thanh yêu thích của tôi là quán cà phê — nghe như đang thật sự ở đó cùng mọi người. Tôi hoàn toàn đề xuất Focoya!"
  },
  {
    name: "Jordynnne",
    text: "Tôi thích ứng dụng này — lúc nào cũng dùng trong lớp. Tôi thích có thể chọn nhiều hình nền, đồng hồ và nhạc khác nhau!",
    photo: "/assets/images/cbb0d22a70bc7593f8e6.webp"
  },
  {
    name: "Gurleen G.",
    text: "Những câu trích dẫn hằng ngày truyền cảm hứng cho tôi và đồng hồ Pomodoro hoạt động rất tốt. Tôi có thể hoàn thành nhiều việc chỉ trong 2 giờ."
  },
  {
    name: "Paul",
    text: "Focoya là công cụ tuyệt vời nhất tôi có thể mong đợi. Ứng dụng giúp tôi vượt qua khó khăn do ADHD và tập trung hơn!"
  },
  {
    name: "Danika N.",
    text: "Focoya giúp tôi tập trung, còn những câu trích dẫn luôn khiến tôi vui hơn. Hình minh họa rất đẹp và nhạc được chọn lọc kỹ."
  },
  {
    name: "Juliana A.",
    text: "Tôi thích ứng dụng này! Nhẹ nhàng, tiện dụng; tôi cũng rất thích hình nền và tích hợp Spotify."
  },
  {
    name: "Ozu",
    text: "Ứng dụng thật tuyệt! Tôi dùng Focoya để học và cảm thấy vô cùng thư thái.",
    photo: "/assets/images/ff3c75d406099f4a8db4.webp"
  },
  {
    name: "Emma O.",
    text: "Một ứng dụng tuyệt vời, có lẽ là trang web tốt nhất tôi từng dùng. Ứng dụng hỗ trợ tôi rất nhiều trong việc học."
  },
  {
    name: "ajer",
    title: "Trường học",
    text: "Giao diện đẹp quá. Tôi thích thế giới cửa hàng tiện lợi dưới chân núi Phú Sĩ."
  }
];

export const TRUST_LOGOS = [
  { name: "NYU", src: "/assets/images/8426a57ba61afb66e1f1.svg" },
  { name: "Cambridge", src: "/assets/images/4ab5da0482b67207ae64.svg" },
  { name: "MIT", src: "/assets/images/6a094b44be993e231460.svg" },
  { name: "Netflix", src: "/assets/images/5787551b8de42aef368c.svg" },
  { name: "Spotify", src: "/assets/images/4f8bc335789a5c507349.svg" },
  { name: "Adobe", src: "/assets/images/f2a561de5b9614b18689.svg" },
  { name: "Amazon", src: "/assets/images/861ce6e1221b665f852a.svg" }
];

export const FEATURE_CARDS = [
  {
    href: "#features",
    emoji: "⏱️",
    title: "Đồng hồ tập trung tùy chỉnh",
    description: "Chọn Pomodoro, đếm ngược, bấm giờ hoặc Animedoro; thiết lập nhịp làm việc phù hợp với bạn."
  },
  {
    href: "#features",
    emoji: "✔️",
    title: "Danh sách việc ưu tiên",
    description: "Luôn biết việc tiếp theo là gì. Thêm thời lượng dự kiến để nắm rõ lịch trình và giữ việc quan trọng ở vị trí đầu."
  },
  {
    href: "#features",
    emoji: "📊",
    title: "Thống kê tập trung",
    description: "Theo dõi chuỗi tập trung theo ngày, tuần và tháng; biến những ngày hiệu quả thành thói quen bền vững."
  },
  {
    href: "#features",
    emoji: "🌎",
    title: "Giao diện truyền cảm hứng",
    description: "Chọn hình nền động hoặc tĩnh, từ những miền đất mộng mơ đến phong cách tối giản; hoặc thêm video YouTube của riêng bạn."
  },
  {
    href: "#features",
    emoji: "🏝️",
    title: "Âm thanh thư giãn",
    description: "Kết hợp âm thanh hỗ trợ tập trung với khung cảnh quán cà phê, tiếng mưa hay lò sưởi để tạo không gian phù hợp."
  },
  {
    emoji: "👏",
    title: "Câu nói truyền cảm hứng",
    description: "Tiếp thêm động lực với những câu nói hằng ngày về tinh thần, chăm sóc bản thân và lòng biết ơn."
  },
  {
    href: "#features",
    emoji: "🎧",
    title: "Âm nhạc tích hợp",
    description: "Nghe danh sách nhạc được chọn lọc để tập trung sâu hoặc phát nhạc từ nguồn bạn yêu thích."
  },
  {
    emoji: "👋",
    title: "Đồng hồ và lời chào",
    description: "Không gian làm việc thân thuộc ngay khi mở ứng dụng, với đồng hồ nổi bật và lời chào gọi tên bạn."
  },
  {
    emoji: "🚀",
    title: "Những tiện ích nhỏ",
    description: "Cửa sổ nổi, chế độ tối giản, âm báo vui nhộn cùng nhiều chi tiết được chăm chút để bạn không phải bận tâm."
  }
];

export const MODES = [
  { id: "ambient", label: "Thư giãn", icon: "🌿" },
  { id: "home", label: "Không gian riêng", icon: "🏠" },
  { id: "focus", label: "Tập trung", icon: "💡" }
];

export const PAIN_POINTS = [
  "Không gian làm việc thiếu cảm hứng",
  "Công cụ không hợp cách làm việc",
  "Âm nhạc làm gián đoạn mạch tập trung",
  "Quá nhiều ứng dụng gây xao nhãng",
  "Đồng hồ không theo nhịp của bạn",
  "Năng suất thiếu dấu ấn cá nhân",
  "Khó duy trì sự tập trung",
  "Khó cảm nhận thời gian",
  "Bận rộn nhưng chưa hiệu quả",
  "Ngày dài trôi qua lúc nào không hay",
  "Danh sách việc cần làm quá tải"
];

export const BUTTON_EMOJI_PAIRS: [string, string][] = [
  ["✨", "✨"],
  ["🍵", "📖"],
  ["🚀", "🌟"],
  ["🎧", "👩‍💻"],
  ["🍃", "🧘"],
  ["💻", "🖊️"],
  ["☕", "⚡"],
  ["⏱️", "🌸"],
  ["🧠", "⚡"]
];
