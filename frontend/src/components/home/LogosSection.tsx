import { Image } from "@/components/common/Image";
import { TRUST_LOGOS } from "@/data/homeData";

export function LogosSection() {
  return (
    <section className="logos-section">
      <div className="container">
        <p>Được hơn 1 triệu người dùng tin chọn tại các công ty và trường đại học hàng đầu</p>
        <div className="logo-ticker-wrapper">
          <div className="logo-ticker">
            {[...TRUST_LOGOS, ...TRUST_LOGOS].map((logo, index) => (
              <Image
                src={logo.src}
                alt={logo.name}
                width={160}
                height={24}
                style={{ width: "auto" }}
                key={`${logo.name}-${index}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
