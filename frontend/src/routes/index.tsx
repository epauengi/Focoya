import { createBrowserRouter, redirect } from "react-router";
import { isDemoAuthenticated } from "@/auth/demoSession";
import { DashboardPage } from "./dashboard/DashboardPage";
import { RootLayout } from "@/layouts/RootLayout";
import { LandingPage } from "./landing/LandingPage";
import { LoginPage } from "./authentication/LoginPage";
import { RegisterPage } from "./authentication/RegisterPage";
import { ForgotPasswordPage } from "./authentication/ForgotPasswordPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: "/dashboard",
        loader: () => isDemoAuthenticated() ? null : redirect("/login"),
        element: <DashboardPage />,
      },
      {
        path: "/login",
        element: <LoginPage />,
      },
      {
        path: "/register",
        element: <RegisterPage />,
      },
      {
        path: "/forgot-password",
        element: <ForgotPasswordPage />,
      },
    ],
  },

  {
    path: "*",
    element: (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <h1 className="text-4xl font-extrabold text-[var(--color-text)]">
          404
        </h1>
        <p className="text-[var(--color-text-muted)] mt-2">
          Trang không tồn tại.
        </p>
        <a href="/" className="btn btn-primary mt-4">
          Về trang chủ
        </a>
      </div>
    ),
  },
]);
