import { Outlet } from "react-router";
import { AmbientLayer } from "@/components/ambient/AmbientLayer";

export function RootLayout() {
  return (
    <div className="relative min-h-screen w-full">
      <AmbientLayer />
      <div className="relative z-10 min-h-screen flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
