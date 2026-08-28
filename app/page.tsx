import Link from "next/link";
import { SettingsIcon } from "lucide-react";

import { ModelForm } from "@/components/rodeos/model-form";
import { FullscreenButton } from "@/components/rodeos/fullscreen-button";
import { SiteFooter, SiteHeader } from "@/components/rodeos/site-chrome";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader>
        <a
          href="/api/semantic-model"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-(--rox-blue) underline-offset-4 hover:underline"
        >
          semantic_model.json
        </a>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-xs font-medium text-(--rox-blue) underline-offset-4 hover:underline"
        >
          <SettingsIcon className="size-3.5" />
          Settings
        </Link>
        <FullscreenButton />
      </SiteHeader>

      <main className="w-full flex-1 px-6 py-6 xl:px-10">
        <ModelForm />
      </main>

      <SiteFooter />
    </div>
  );
}
