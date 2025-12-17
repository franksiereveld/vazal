import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Leaf, Users, Scale, Globe, Heart, ShieldCheck } from "lucide-react";

export default function Mission() {
  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const stagger = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="container max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16 space-y-6"
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            Mission & Impact
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            We are building NatureNeutral.AI. Our promise is simple: As we scale intelligence, we scale nature.
          </p>
        </motion.div>

        {/* Core Pillars */}
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="grid md:grid-cols-2 gap-8 mb-20"
        >
          <motion.div variants={fadeIn}>
            <Card className="p-8 h-full border-2 hover:border-primary/50 transition-colors">
              <div className="p-3 bg-green-100 dark:bg-green-900/20 w-fit rounded-xl mb-6">
                <Leaf className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold mb-4">Protecting Nature</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                For every 1MW of compute capacity we deploy, we permanently protect or restore <strong>500 acres of nature</strong> nearby.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Biodiversity corridors
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Reforestation projects
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Wetland preservation
                </li>
              </ul>
            </Card>
          </motion.div>

          <motion.div variants={fadeIn}>
            <Card className="p-8 h-full border-2 hover:border-primary/50 transition-colors">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 w-fit rounded-xl mb-6">
                <Globe className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold mb-4">Carbon Negative</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We don't just aim for neutral. We aim for negative. Our infrastructure is designed to remove more carbon than it emits.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Immersion cooling (PUE 1.03)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Heat recycling for communities
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  78,000 tons CO₂ sequestered/year
                </li>
              </ul>
            </Card>
          </motion.div>
        </motion.div>

        {/* The Three Laws */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">The Three Ethical Laws</h2>
            <p className="text-muted-foreground">The foundation of our AI development</p>
          </div>

          <div className="grid gap-6">
            {[
              {
                title: "1. Human Sovereignty",
                desc: "AI must always remain under explicit human control. No autonomous actions without user consent. Your agent serves you, and only you.",
                icon: Users
              },
              {
                title: "2. Absolute Privacy",
                desc: "Data never leaves your infrastructure. No training on user data. No third-party access. What happens on your node stays on your node.",
                icon: ShieldCheck
              },
              {
                title: "3. Planetary Stewardship",
                desc: "Intelligence cannot come at the cost of the biosphere. Every cycle of compute must account for its ecological footprint.",
                icon: Heart
              }
            ].map((law, i) => (
              <Card key={i} className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center hover:bg-accent/5 transition-colors">
                <div className="p-4 bg-primary/10 rounded-full shrink-0">
                  <law.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">{law.title}</h3>
                  <p className="text-muted-foreground">{law.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Community Impact */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="bg-card border border-border rounded-3xl p-8 md:p-12 text-center space-y-8"
        >
          <Scale className="w-12 h-12 mx-auto text-primary" />
          <h2 className="text-3xl font-bold">Helping Communities</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Our data centers aren't fortresses; they are community assets. We open our protected lands to the public, provide free heat to local district heating systems, and offer educational programs on sustainable technology.
          </p>
          
          <div className="pt-8">
            <p className="text-sm font-medium mb-4">Want to learn more or get involved?</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                Stay Updated
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              We'll share our progress on NatureNeutral.AI and upcoming community events.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
