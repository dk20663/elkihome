import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import GuestView from "@/components/GuestView";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
});

/**
 * Public embed wrapper for elkihome24.ru (Tilda).
 * Renders the exact same GuestView used in-app — no duplicated logic.
 * Posts its content height to the parent so the host iframe can auto-resize.
 */
export default function EmbedApp() {
  useEffect(() => {
    const post = () => {
      const h = document.documentElement.scrollHeight;
      window.parent?.postMessage({ type: "elkihome-height", height: h }, "*");
    };
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <GuestView onBack={() => {}} hideBack />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
