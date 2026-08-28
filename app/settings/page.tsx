import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { SettingsForm } from "@/components/rodeos/settings-form"
import { SiteFooter, SiteHeader } from "@/components/rodeos/site-chrome"

export const metadata = {
  title: "Settings — RODEOS Semantic Model Generator",
}

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-medium text-(--rox-blue) underline-offset-4 hover:underline"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back to the generator
        </Link>
      </SiteHeader>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-6 xl:px-10">
        <div className="mb-6 flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-(--rox-blue-deep) dark:text-(--rox-blue-soft)">
            LLM providers
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            The AI autofill runs against these endpoints. Anything speaking the
            OpenAI protocol works — the IONOS AI Model Hub, OpenAI, a local
            vLLM or LM Studio server, or an internal gateway. Add the endpoint
            URL and your key here instead of editing the .env file.
          </p>
        </div>

        <SettingsForm />
      </main>

      <SiteFooter />
    </div>
  )
}
