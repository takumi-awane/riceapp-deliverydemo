import { motion } from "framer-motion";

export function MotionWrapper({ page, children }) {
    return (
        <motion.div
            key={page}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ height: "100%", width: "100%" }}
        >
            {children}
        </motion.div>
    )
}