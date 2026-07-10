import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, Home, Settings as SettingsIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const AppHeader = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
  };

  const showHome = user && location.pathname !== "/app";

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground tracking-tight">
            Trading Journal <span className="text-primary">Pro App</span>
          </h1>
          <p className="text-xs text-muted-foreground">by ScarFinance</p>
        </div>

        {user && (
          <div className="flex items-center gap-2 sm:gap-3">
            {showHome && (
              <Button asChild variant="outline" size="sm">
                <Link to="/app">
                  <Home className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Menú</span>
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link to="/settings">
                <SettingsIcon className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Ajustes</span>
              </Link>
            </Button>
            <span className="text-sm text-muted-foreground hidden md:inline">{user.email}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};

export default AppHeader;
