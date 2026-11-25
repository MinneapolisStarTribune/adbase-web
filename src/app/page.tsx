import Link from "next/link";
import { ForecastingError } from "@/modules/forecasting/domain/models";
import { getCurrentActor } from "@/server/auth/current-actor";
import { getRuntime } from "@/server/runtime";
import { SignIn } from "./components/sign-in";
import { Workspace } from "./components/workspace";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function Home() {
  try {
    const runtime = getRuntime();
    let actor;
    try {
      actor = await getCurrentActor();
    } catch (error) {
      if (
        !(error instanceof ForecastingError) ||
        error.code !== "UNAUTHENTICATED"
      )
        throw error;
    }
    return (
      <main>
        <header className="masthead">
          <Link href="/" className="brand">
            ADBASE
          </Link>
          <span className="badge">Sample workspace</span>
        </header>
        <section className="intro">
          <p className="eyebrow">REVENUE PLANNING</p>
          <h1>Forecasting Grid</h1>
          <p>
            Plan monthly revenue, maintain advertisers, and export forecasts.
          </p>
        </section>
        {actor ? (
          <Workspace bootstrap={await runtime.service.bootstrap(actor)} />
        ) : (
          <SignIn
            accounts={(await runtime.repo.metadata()).personas.map(
              ({ id, name }) => ({ id, name }),
            )}
          />
        )}
        <footer>
          Fictional data · Changes are shared within this sample server and
          reset on restart.
        </footer>
      </main>
    );
  } catch {
    return (
      <main>
        <h1>Workspace unavailable</h1>
        <p>
          The application configuration is not ready. Contact the application
          owner.
        </p>
      </main>
    );
  }
}
