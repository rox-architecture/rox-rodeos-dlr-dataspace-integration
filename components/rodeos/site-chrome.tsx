import Image from "next/image"
import Link from "next/link"

/**
 * The RoX-branded frame shared by every page: gradient bar, header with the
 * logo, and the funding footer.
 */
export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <>
      {/* RoX brand gradient bar */}
      <div className="rox-gradient h-1 w-full" />

      <header className="border-b bg-background">
        <div className="flex w-full items-center justify-between gap-4 px-6 py-4 xl:px-10">
          <Link href="/" className="flex items-center gap-4">
            <Image
              src="/rox/logo-rox.png"
              alt="RoX — Enabling AI Robotics"
              width={96}
              height={50}
              priority
              className="h-10 w-auto"
            />
            <div className="flex flex-col">
              <h1 className="text-lg leading-tight font-semibold text-(--rox-blue-deep) dark:text-(--rox-blue-soft)">
                RODEOS Semantic Model Generator
              </h1>
              <p className="text-xs text-muted-foreground">
                RObotic Data EcOsystem — semantic descriptions for the RoX / DLR
                dataspace
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-3">{children}</div>
        </div>
      </header>
    </>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="flex w-full flex-wrap items-center justify-between gap-4 px-6 py-4 xl:px-10">
        <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
          Developed within the RoX project. Funded by the European Union —
          NextGenerationEU (IPCEI-CIS, grant 13IPC034) and the German Federal
          Ministry for Economic Affairs.
        </p>
        <Image
          src="/rox/funding-combined.png"
          alt="Funded by the European Union — NextGenerationEU and BMWK"
          width={178}
          height={100}
          className="h-14 w-auto"
        />
      </div>
    </footer>
  )
}
