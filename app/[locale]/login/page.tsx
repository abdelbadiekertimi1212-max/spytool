import { setRequestLocale } from "next-intl/server";

import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  return <LoginForm />;
}
