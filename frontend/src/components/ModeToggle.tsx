import { useState } from "react";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "./ui/popover";
import { Sun, Moon, Monitor } from "lucide-react";

export function ModeToggle() {
    const { theme, setTheme } = useTheme();
    const [open, setOpen] = useState(false);

    const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
        setTheme(newTheme);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-36 p-1 bg-popover border-border">
                <div className="flex flex-col gap-1">
                    <Button
                        variant={theme === "light" ? "secondary" : "ghost"}
                        size="sm"
                        className="justify-start gap-2 font-medium"
                        onClick={() => handleThemeChange("light")}
                    >
                        <Sun size={14} />
                        <span>Light</span>
                    </Button>
                    <Button
                        variant={theme === "dark" ? "secondary" : "ghost"}
                        size="sm"
                        className="justify-start gap-2 font-medium"
                        onClick={() => handleThemeChange("dark")}
                    >
                        <Moon size={14} />
                        <span>Dark</span>
                    </Button>
                    <Button
                        variant={theme === "system" ? "secondary" : "ghost"}
                        size="sm"
                        className="justify-start gap-2 font-medium"
                        onClick={() => handleThemeChange("system")}
                    >
                        <Monitor size={14} />
                        <span>System</span>
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
