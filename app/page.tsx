import { Header } from "./components/Header";
import { TabLayout } from "./components/TabLayout";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Header />
      <TabLayout />
    </div>
  );
}
