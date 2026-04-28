"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Bot,
  Cpu,
  HomeIcon,
  Lock,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const features = [
  {
    title: "Room Intelligence",
    description: "Control lighting, climate, scenes, and devices by room.",
    icon: HomeIcon,
  },
  {
    title: "Device Control",
    description: "Manage lights, thermostats, sensors, cameras, and plugs.",
    icon: Cpu,
  },
  {
    title: "Automation Engine",
    description: "Build rules using triggers, conditions, and smart actions.",
    icon: Bot,
  },
  {
    title: "Energy Optimization",
    description: "Track consumption and reduce unnecessary power usage.",
    icon: PlugZap,
  },
  {
    title: "Security Monitoring",
    description: "Monitor locks, cameras, motion, alerts, and access events.",
    icon: ShieldCheck,
  },
  {
    title: "Smart Analytics",
    description: "Understand temperature, energy, automation, and device trends.",
    icon: BarChart3,
  },
];

const stats = [
  { label: "Connected Devices", value: "42" },
  { label: "Active Automations", value: "18" },
  { label: "Energy Saved", value: "12%" },
  { label: "Device Uptime", value: "96%" },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0B0F14] text-[#F9FAFB]">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-1/2 top-[-20%] h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-blue-500/20 blur-[130px]"
        />
        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0.9, 0.6] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-25%] right-[-10%] h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-[120px]"
        />
      </div>

      <motion.header
        initial="hidden"
        animate="show"
        variants={fadeUp}
        transition={{ duration: 0.6 }}
        className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6"
      >
        <Link href="/" className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-blue-500/10 backdrop-blur">
            <span className="text-xl font-bold text-[#3B82F6]">N</span>
          </div>
          <div>
            <p className="font-semibold text-white">Nexora Home</p>
            <p className="text-xs text-[#9CA3AF]">Smart IoT Control</p>
          </div>
        </Link>

        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
          <Link
            href="/dashboard"
            className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Launch Demo
          </Link>
        </motion.div>
      </motion.header>

      <section className="mx-auto flex max-w-7xl flex-col items-center px-6 pb-20 pt-16 text-center md:pt-24">
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          className="flex flex-col items-center"
        >
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-400"
          >
            <Sparkles className="size-4" />
            Portfolio-grade smart home SaaS demo
          </motion.div>

          <motion.h1
            variants={fadeUp}
            transition={{ duration: 0.7 }}
            className="max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-6xl md:text-7xl"
          >
            Intelligent control for a calmer, safer, more efficient home.
          </motion.h1>

          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.7 }}
            className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#9CA3AF] sm:text-lg"
          >
            Nexora Home is a premium IoT dashboard experience for monitoring
            rooms, devices, automation, security, analytics, and energy usage
            from one modern interface.
          </motion.p>

          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.7 }}
            className="mt-10 flex flex-col justify-center gap-4 sm:flex-row"
          >
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/dashboard"
                className="inline-flex rounded-full bg-[#3B82F6] px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-500"
              >
                Open Dashboard
              </Link>
            </motion.div>

            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <a
                href="#features"
                className="inline-flex rounded-full border border-white/10 bg-white/5 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Explore Features
              </a>
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.35, ease: "easeOut" }}
          className="mt-16 w-full rounded-[2rem] border border-white/10 bg-white/[0.04] p-3 shadow-2xl shadow-black/40 backdrop-blur"
        >
          <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0B0F14]">
            <div className="grid min-h-[620px] lg:grid-cols-[240px_1fr]">
              <aside className="hidden border-r border-white/10 bg-white/[0.025] p-4 text-left lg:block">
                <div className="mb-8 flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                    <span className="text-xl font-bold text-blue-400">N</span>
                  </div>
                  <div>
                    <p className="font-semibold text-white">Nexora Home</p>
                    <p className="text-xs text-[#9CA3AF]">Smart IoT Control</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    ["Dashboard", HomeIcon],
                    ["Rooms", HomeIcon],
                    ["Devices", Cpu],
                    ["Automation", Bot],
                    ["Analytics", BarChart3],
                    ["Security", ShieldCheck],
                    ["Energy", PlugZap],
                  ].map(([label, Icon], index) => {
                    const IconComponent = Icon as React.ElementType;

                    return (
                      <motion.div
                        key={label as string}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.55 + index * 0.05 }}
                        className={[
                          "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm",
                          index === 0
                            ? "bg-blue-500/15 text-blue-400"
                            : "text-[#9CA3AF]",
                        ].join(" ")}
                      >
                        <IconComponent className="size-4" />
                        <span>{label as string}</span>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-3 flex items-center gap-2 text-green-400">
                    <Activity className="size-4" />
                    <span className="text-sm font-medium">Live Status</span>
                  </div>
                  <div className="space-y-2 text-xs text-[#9CA3AF]">
                    <div className="flex justify-between">
                      <span>Temperature</span>
                      <span className="text-white">24°C</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Energy</span>
                      <span className="text-white">18.4 kWh</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Security</span>
                      <span className="text-green-400">Armed</span>
                    </div>
                  </div>
                </div>
              </aside>

              <div className="flex flex-col">
                <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                  <div className="text-left">
                    <p className="text-xs text-[#9CA3AF]">
                      Live device monitoring
                    </p>
                    <h2 className="text-lg font-semibold text-white">
                      Home Overview
                    </h2>
                  </div>

                  <div className="hidden items-center gap-3 md:flex">
                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-[#9CA3AF]">
                      Search devices, rooms...
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-400">
                      <ShieldCheck className="size-4" />
                      Secure
                    </div>
                  </div>
                </header>

                <div className="grid gap-4 p-5">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {stats.map((item, index) => (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.75 + index * 0.06 }}
                      >
                        <PreviewMetric {...item} />
                      </motion.div>
                    ))}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                      <div className="mb-5 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-left">
                          <div className="flex size-10 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
                            <Activity className="size-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-white">
                              Temperature & Energy Trends
                            </p>
                            <p className="text-sm text-[#9CA3AF]">
                              Real-time smart home analytics
                            </p>
                          </div>
                        </div>

                        <span className="hidden rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs text-blue-400 sm:block">
                          Last 24h
                        </span>
                      </div>

                      <div className="flex h-44 items-end gap-2">
                        {[42, 58, 48, 72, 63, 86, 68, 78, 55, 74, 92, 70].map(
                          (height, index) => (
                            <div
                              key={index}
                              className="flex flex-1 items-end rounded-full bg-white/[0.04]"
                            >
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${height}%` }}
                                transition={{
                                  duration: 0.7,
                                  delay: 0.9 + index * 0.04,
                                  ease: "easeOut",
                                }}
                                className="w-full rounded-full bg-gradient-to-t from-blue-500 to-emerald-400"
                              />
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <PreviewRoomCard
                        title="Living Room"
                        status="Movie Night"
                        value="8 devices on"
                        tone="blue"
                      />
                      <PreviewRoomCard
                        title="Kitchen"
                        status="High Usage"
                        value="5.8 kWh"
                        tone="amber"
                      />
                      <PreviewRoomCard
                        title="Security Hub"
                        status="Armed"
                        value="All zones active"
                        tone="green"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-3">
                    <MiniPanel
                      icon={Bot}
                      title="Automation"
                      value="43 runs today"
                      tone="blue"
                    />
                    <MiniPanel
                      icon={Lock}
                      title="Security"
                      value="Armed · Night Mode"
                      tone="green"
                    />
                    <MiniPanel
                      icon={Zap}
                      title="Energy"
                      value="12% optimized"
                      tone="amber"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 py-20">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-120px" }}
          variants={fadeUp}
          transition={{ duration: 0.65 }}
          className="mx-auto mb-12 max-w-2xl text-center"
        >
          <p className="text-sm font-medium uppercase tracking-[0.35em] text-blue-400">
            Product Modules
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Everything a smart home control system needs.
          </h2>
          <p className="mt-4 text-[#9CA3AF]">
            Built to demonstrate real product thinking: control, automation,
            monitoring, analytics, security, and optimization.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-120px" }}
          variants={stagger}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                transition={{ duration: 0.55 }}
                whileHover={{ y: -6, scale: 1.01 }}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/20 backdrop-blur transition hover:border-white/20"
              >
                <div className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
                  <Icon className="size-5" />
                </div>

                <h3 className="text-lg font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#9CA3AF]">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.7 }}
          className="rounded-[2rem] border border-blue-500/20 bg-blue-500/10 p-8 text-center shadow-2xl shadow-blue-500/10 md:p-12"
        >
          <p className="text-sm font-medium uppercase tracking-[0.35em] text-blue-400">
            Ready to explore?
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            Enter the Nexora dashboard and experience the full smart home demo.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[#9CA3AF]">
            Navigate through rooms, devices, automation, analytics, security,
            energy, settings, account, and alerts.
          </p>

          <motion.div
            className="mt-8 inline-flex"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              href="/dashboard"
              className="rounded-full bg-[#3B82F6] px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-500"
            >
              Launch Nexora Home
            </Link>
          </motion.div>
        </motion.div>
      </section>
    </main>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-left">
      <p className="text-xs text-[#9CA3AF]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function PreviewRoomCard({
  title,
  status,
  value,
  tone,
}: {
  title: string;
  status: string;
  value: string;
  tone: "blue" | "green" | "amber";
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-left"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div
          className={[
            "flex size-10 items-center justify-center rounded-2xl border",
            tone === "blue" && "border-blue-500/20 bg-blue-500/10 text-blue-400",
            tone === "green" &&
              "border-green-500/20 bg-green-500/10 text-green-400",
            tone === "amber" &&
              "border-amber-500/20 bg-amber-500/10 text-amber-400",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <HomeIcon className="size-5" />
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-[#9CA3AF]">
          {status}
        </span>
      </div>

      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-[#9CA3AF]">{value}</p>
    </motion.div>
  );
}

function MiniPanel({
  icon: Icon,
  title,
  value,
  tone,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  tone: "blue" | "green" | "amber";
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-left"
    >
      <div
        className={[
          "mb-4 flex size-10 items-center justify-center rounded-2xl border",
          tone === "blue" && "border-blue-500/20 bg-blue-500/10 text-blue-400",
          tone === "green" &&
            "border-green-500/20 bg-green-500/10 text-green-400",
          tone === "amber" &&
            "border-amber-500/20 bg-amber-500/10 text-amber-400",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Icon className="size-5" />
      </div>

      <p className="text-sm text-[#9CA3AF]">{title}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </motion.div>
  );
}