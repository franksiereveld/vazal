import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/contexts/ThemeContext";
import { ArrowRight, Cpu, Database, Zap, Moon, Sun, Server, Sparkles, Monitor } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";

export default function Home() {
  // The userAuth hooks provides authentication state
  // To implement login/logout functionality, simply call logout() or redirect to getLoginUrl()
  let { user, loading, error, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();

  const { theme, toggleTheme } = useTheme();

  const handleStartAgent = () => {
    if (isAuthenticated) {
      setLocation("/agent");
    } else {
      setLocation("/login");
    }
  };

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
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container flex items-center justify-between h-16">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-bold"
          >
            vazal.ai
          </motion.div>
          
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm font-medium hover:text-muted-foreground transition-colors">
              Features
            </a>
            <a href="#journey" className="text-sm font-medium hover:text-muted-foreground transition-colors">
              Journey
            </a>
            <a href="#tech" className="text-sm font-medium hover:text-muted-foreground transition-colors">
              Technology
            </a>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Powered by DeepSeek-R1 70B + OpenManus Foundation</span>
            </div>
            
            <h1 className="text-6xl md:text-8xl font-bold tracking-tight">
              Your Personal
              <br />
              <span className="inline-block mt-2">AI Agent</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Accelerate Yourself!  Complete control, absolute privacy.
              <br />
              Three ethical laws, infinite scale yet good for the planet.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button 
                size="lg" 
                className="text-base px-8 h-12 group"
                onClick={handleStartAgent}
              >
                Start Your Agent &gt;
              </Button>
              <Link href="/mission">
                <Button size="lg" variant="outline" className="text-base px-8 h-12">
                  Learn More
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Journey Timeline */}
      <section id="journey" className="py-20 px-4 bg-card/30">
        <div className="container max-w-6xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Our Journey</h2>
            <p className="text-lg text-muted-foreground">
              Starting in our garage, NYC in H1 2026, global expansion in 2027. We pledge that each added MW is matched by 500 acres of protected nature, nearby each DC location. Sequestering carbon, enhancing biodiversity, open to the community.
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-8"
          >
            {[
              {
                icon: Monitor,
                title: "Full Stack Hardware",
                subtitle: "Today in Zurich",
                description: "Deployed on our custom server with 2x RTX 4090. 48GB VRAM, 25-35 tokens/sec. Complete privacy, instant response.",
                specs: "2x RTX 4090 • 128GB RAM "
              },
              {
                icon: Server,
                title: "Proprietary Architecture",
                subtitle: "Scaling Up in NYC in '26",
                description: "Piloting hybrid rack: 4x NVIDIA L40S + 32x Qualcomm AI accelerators. Immersion cooling, 12kW power, validating architecture for green, ethical scale with 250 racks per 3MW DC. ",
                specs: "Hybrid Pilot Rack • 12kW • Visit us in Manhattan"
              },
              {
                icon: Database,
                title: "3MW Data Centers x N",
                subtitle: "Going Green & Global",
                description: "Full-scale deployment in CA, SC, LA with 60% power savings vs air-cooled, and 95% water savings. Expanding to Sweden, Slovakia, Spain in 2027, and to 500MW globally in 2030. Sequestering net 78k tons carbon per year.",
                specs: "250 Racks • 3MW • Immersion Cooled"
              }
            ].map((stage, index) => (
              <motion.div key={index} variants={fadeIn}>
                <Card className="p-8 h-full hover:shadow-lg transition-shadow border-2">
                  <div className="space-y-6">
                    <div className="flex items-start justify-between">
                      <div className="p-3 rounded-lg bg-accent">
                        <stage.icon className="w-8 h-8" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Stage {index + 1}
                      </span>
                    </div>
                    
                    <div>
                      <h3 className="text-2xl font-bold mb-1">{stage.title}</h3>
                      <p className="text-sm text-muted-foreground font-medium">{stage.subtitle}</p>
                    </div>
                    
                    <p className="text-muted-foreground leading-relaxed">
                      {stage.description}
                    </p>
                    
                    <div className="pt-4 border-t border-border">
                      <code className="text-xs text-muted-foreground">{stage.specs}</code>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>


        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container max-w-6xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Built Different</h2>
            <p className="text-lg text-muted-foreground">
              Enterprise capabilities, personal control
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 gap-6"
          >
            {[
              {
                title: "Complete Privacy",
                description: "Your data never leaves your infrastructure. No cloud dependencies, no third-party access, absolute control."
              },
              {
                title: "Open Source Stack",
                description: "Built on DeepSeek-R1 70B + OpenManus Foundation. Apache 2.0 licensed, fully auditable, community-driven innovation."
              },
              {
                title: "Infinite Scale",
                description: "Start with a PC, scale to data centers. Same agent, same API, seamless migration at any stage."
              },
              {
                title: "Cost Efficient",
                description: "5x cheaper than cloud APIs at scale. Self-hosting pays for itself in 1.5-2 years with full ownership."
              },
              {
                title: "Low Latency",
                description: "Local inference means instant response. 25-35 tokens/sec on PC, 240-300 tokens/sec on rack infrastructure."
              },
              {
                title: "Carbon Negative",
                description: "Immersion cooling, renewable energy, 58% power savings. Sustainability built into every layer."
              }
            ].map((feature, index) => (
              <motion.div key={index} variants={fadeIn}>
                <Card className="p-6 h-full hover:border-foreground transition-colors">
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section id="tech" className="py-20 px-4 bg-card/30">
        <div className="container max-w-4xl">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Technology</h2>
            <p className="text-lg text-muted-foreground">
              Open source, production-ready, battle-tested
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <Card className="p-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2">OpenManus Foundation</h3>
                  <p className="text-muted-foreground">
                    51,300+ stars • MIT License • Production-ready agent framework
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 pt-4">
                  <div>
                    <h4 className="font-semibold mb-2">Core Features</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Multi-agent workflows</li>
                      <li>• Browser automation</li>
                      <li>• Code execution sandbox</li>
                      <li>• Model Context Protocol</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Deployment</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• 30-minute setup</li>
                      <li>• Docker support</li>
                      <li>• Any LLM backend</li>
                      <li>• Massive community</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2">DeepSeek-R1 70B</h3>
                  <p className="text-muted-foreground">
                    Apache 2.0 License • State-of-the-art reasoning • Self-hostable
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 pt-4">
                  <div>
                    <h4 className="font-semibold mb-2">Performance</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• 70B parameters</li>
                      <li>• 4-bit quantization</li>
                      <li>• 48GB VRAM (2x GPU)</li>
                      <li>• 25-35 tokens/sec</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Capabilities</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Advanced reasoning</li>
                      <li>• Code generation</li>
                      <li>• Multi-turn dialogue</li>
                      <li>• Function calling</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-4">
        <div className="container max-w-4xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-center space-y-8 p-12 rounded-2xl border-2 border-foreground bg-accent"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-foreground bg-background">
              <Zap className="w-4 h-4" />
              <span className="text-sm font-medium">Ready to Deploy</span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold">
              Start Your AI Journey
            </h2>
            
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Deploy your personal AI agent today. Start with a PC, scale to infinity.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button size="lg" className="text-base px-8 h-12 group">
                Get Started
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 h-12">
                View Documentation
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4">
        <div className="container max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-lg mb-4">vazal.ai</h3>
              <p className="text-sm text-muted-foreground">
                Your personal AI agent platform. From PC to data center.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#journey" className="hover:text-foreground transition-colors">Journey</a></li>
                <li><a href="#tech" className="hover:text-foreground transition-colors">Technology</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API Reference</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">GitHub</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Community</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2025 vazal.ai. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
