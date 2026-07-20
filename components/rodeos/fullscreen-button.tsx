"use client"

import * as React from "react"
import { MaximizeIcon, MinimizeIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function FullscreenButton() {
  const [fullscreen, setFullscreen] = React.useState(false)

  React.useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  const toggle = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await document.documentElement.requestFullscreen()
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      title={fullscreen ? "Exit fullscreen" : "Fullscreen (kiosk)"}
    >
      {fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
    </Button>
  )
}
