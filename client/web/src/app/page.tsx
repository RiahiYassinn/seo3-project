import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4 text-center">
          SEO3 Developer Analytics Platform
        </h1>
        <p className="text-center mb-8">
          Analyze your development activity, track skills, and get personalized
          learning recommendations
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <Link
            href="/dashboard"
            className="p-6 border rounded-lg hover:border-gray-400"
          >
            <h2 className="text-2xl font-semibold mb-2">Dashboard</h2>
            <p>View your development analytics and insights</p>
          </Link>

          <Link
            href="/skills"
            className="p-6 border rounded-lg hover:border-gray-400"
          >
            <h2 className="text-2xl font-semibold mb-2">Skills</h2>
            <p>Track and manage your skill development</p>
          </Link>

          <Link
            href="/recommendations"
            className="p-6 border rounded-lg hover:border-gray-400"
          >
            <h2 className="text-2xl font-semibold mb-2">Recommendations</h2>
            <p>Get personalized learning paths</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
