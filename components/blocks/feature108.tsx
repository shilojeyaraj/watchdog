"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import { MapPin, Camera, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface TabContent {
  badge: string;
  title: string;
  description: string;
  buttonText: string;
  buttonHref: string;
  imageSrc: string;
  imageAlt: string;
}

interface Tab {
  value: string;
  icon: React.ReactNode;
  label: string;
  content: TabContent;
}

interface Feature108Props {
  badge?: string;
  heading?: string;
  description?: string;
  tabs?: Tab[];
}

const defaultTabs: Tab[] = [
  {
    value: "tab-1",
    icon: <Camera className="h-auto w-4 shrink-0" />,
    label: "AI Video Analysis",
    content: {
      badge: "Real-Time Detection",
      title: "See threats the moment they appear.",
      description:
        "Watchdog streams live CCTV footage through an AI vision model that classifies each frame as SAFE, WARNING, or DANGER. Three consecutive DANGER reads trigger an immediate SMS alert to your team - no manual monitoring required.",
      buttonText: "Start Camera",
      buttonHref: "/camera",
      imageSrc: "/images/feature-camera.png",
      imageAlt: "AI camera feed showing threat detection",
    },
  },
  {
    value: "tab-2",
    icon: <MapPin className="h-auto w-4 shrink-0" />,
    label: "Live Danger Map",
    content: {
      badge: "Situational Awareness",
      title: "Know exactly where danger is.",
      description:
        "Each detection event is plotted on an interactive map with precise coordinates and severity. First responders get a bird's-eye view of victim positions and hazard zones in real time, so they arrive informed and act faster.",
      buttonText: "View Map",
      buttonHref: "/dashboard",
      imageSrc: "/images/feature-map.png",
      imageAlt: "Live incident map with danger zones",
    },
  },
  {
    value: "tab-3",
    icon: <ShieldAlert className="h-auto w-4 shrink-0" />,
    label: "Incident Management",
    content: {
      badge: "Full Audit Trail",
      title: "Track every incident from alert to resolution.",
      description:
        "Watchdog automatically creates incidents when sustained danger is detected, logs every status change, and keeps a full history of events. Teams can acknowledge, respond, and close incidents - with resolution notes - all in one place.",
      buttonText: "Open Dashboard",
      buttonHref: "/dashboard",
      imageSrc: "/images/feature-incident.png",
      imageAlt: "Incident management dashboard",
    },
  },
];

const Feature108 = ({
  badge = "Watchdog",
  heading = "Real-Time Threat Detection for First Responders",
  description = "AI-powered CCTV analysis, live danger mapping, and instant SMS alerts - all in one command centre.",
  tabs = defaultTabs,
}: Feature108Props) => {
  return (
    <section id="about" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <Badge variant="outline">{badge}</Badge>
          <h2 className="max-w-2xl text-3xl font-semibold md:text-4xl text-foreground">
            {heading}
          </h2>
          <p className="text-muted-foreground max-w-xl">{description}</p>
        </div>

        <Tabs defaultValue={tabs[0].value} className="mt-10">
          <TabsList className="flex flex-col items-center justify-center gap-4 sm:flex-row md:gap-8">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground data-[state=active]:bg-muted data-[state=active]:text-primary cursor-pointer transition-colors"
              >
                {tab.icon} {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mx-auto mt-8 max-w-screen-xl rounded-2xl bg-muted/50 border border-border p-6 lg:p-16">
            {tabs.map((tab) => (
              <TabsContent
                key={tab.value}
                value={tab.value}
                className="grid place-items-center gap-12 lg:grid-cols-2 lg:gap-10"
              >
                <div className="flex flex-col gap-5">
                  <Badge variant="outline" className="w-fit bg-background">
                    {tab.content.badge}
                  </Badge>
                  <h3 className="text-3xl font-semibold lg:text-4xl text-foreground">
                    {tab.content.title}
                  </h3>
                  <p className="text-muted-foreground lg:text-lg">
                    {tab.content.description}
                  </p>
                  <Button
                    asChild
                    className={[
                      "mt-2.5 w-fit gap-2",
                      // Make the dashboard CTA pop with a darker button for contrast
                      tab.content.buttonHref === "/dashboard"
                        ? "bg-black text-white hover:bg-black/90 border border-white/10"
                        : "",
                    ].join(" ")}
                    size="lg"
                  >
                    <Link href={tab.content.buttonHref}>
                      {tab.content.buttonText}
                    </Link>
                  </Button>
                </div>

                <div className="w-full aspect-video rounded-xl bg-muted flex items-center justify-center overflow-hidden border border-border">
                  {/* Replace src with real screenshots once available */}
                  <img
                    src={tab.content.imageSrc}
                    alt={tab.content.imageAlt}
                    className="rounded-xl w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                  <span className="text-muted-foreground text-sm absolute">
                    {tab.content.imageAlt}
                  </span>
                </div>
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </section>
  );
};

export { Feature108 };
