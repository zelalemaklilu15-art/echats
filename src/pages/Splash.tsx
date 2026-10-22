import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import logoImage from "@/assets/echat-logo.png";

const Splash = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => navigate("/auth"), 3000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden relative" style={{ background: "hsl(222 22% 5%)" }}>
      {/* Animated gradient rings */}
      {[220, 180, 140].map((size, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-primary/10"
          style={{ width: size, height: size }}
          animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 3.5, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
        />
      ))}

      {/* Blobs */}
      <motion.div className="absolute w-64 h-64 rounded-full bg-primary/10 blur-[80px] top-10 left-10"
        animate={{ scale: [1, 1.2, 1], x: [0, 15, 0], y: [0, -20, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div className="absolute w-48 h-48 rounded-full bg-purple-600/10 blur-[60px] bottom-20 right-10"
        animate={{ scale: [1, 1.15, 1], x: [0, -10, 0], y: [0, 15, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-7">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.1 }}
          className="relative"
        >
          <motion.div
            className="absolute inset-0 rounded-3xl bg-primary/25 blur-2xl"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative w-28 h-28 rounded-3xl overflow-hidden" style={{ boxShadow: "0 12px 48px hsl(338 90% 67% / 0.4), 0 0 0 1px hsl(338 90% 67% / 0.15)" }}>
            <img src={logoImage} alt="Echat" className="w-full h-full object-cover" />
          </div>
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7 }}
          className="text-center"
        >
          <h1 className="text-[34px] font-black gradient-text tracking-tight">Echat</h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="text-muted-foreground text-[15px] mt-2 font-medium"
          >
            Fast · Secure · Beautiful
          </motion.p>
        </motion.div>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="w-44 h-1 bg-muted/60 rounded-full overflow-hidden"
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--gradient-primary)" }}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ delay: 1.1, duration: 1.9, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    </div>
  );
};

export default Splash;
