import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function dynamicPwaManifestPlugin() {
  return {
    name: 'dynamic-pwa-manifest',
    generateBundle(this: any) {
      const isDev = process.env.VITE_APP_ENV === 'development' || 
                    process.env.VERCEL_ENV === 'preview';

      const manifestData = {
        name: isDev ? "Smart Staff (DEV)" : "Smart Staff Attendance",
        short_name: isDev ? "Smart (DEV)" : "SmartStaff",
        description: "Staff Portal for Smart Staff Attendance System.",
        id: isDev ? "com.smart.attendance.staff.dev" : "com.smart.attendance.staff",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "minimal-ui", "window-controls-overlay"],
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: isDev ? "#7c3aed" : "#2563eb",
        categories: ["business", "productivity", "utilities"],
        dir: "ltr",
        lang: "en-US",
        prefer_related_applications: false,
        launch_handler: {
          client_mode: ["navigate-existing", "auto"]
        },
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ],
        screenshots: [
          { src: "/screenshots/login.png", sizes: "1000x1000", type: "image/png", form_factor: "narrow", label: "Staff Login" },
          { src: "/screenshots/login_mobile.png", sizes: "375x812", type: "image/png", form_factor: "narrow", label: "Staff Mobile Portal" }
        ],
        shortcuts: [
          { name: "Mark Attendance", short_name: "Mark", description: "Quickly mark staff attendance", url: "/staff/mark-attendance", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Attendance History", short_name: "History", description: "View past attendance records", url: "/staff/attendance-history", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }
        ]
      };

      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(manifestData, null, 2)
      });
    },
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === '/manifest.json') {
          const isDev = process.env.VITE_APP_ENV !== 'production';
          const manifestData = {
            name: isDev ? "Smart Staff (DEV)" : "Smart Staff Attendance",
            short_name: isDev ? "Smart (DEV)" : "SmartStaff",
            description: "Staff Portal for Smart Staff Attendance System.",
            id: isDev ? "com.smart.attendance.staff.dev" : "com.smart.attendance.staff",
            start_url: "/",
            scope: "/",
            display: "standalone",
            display_override: ["standalone", "minimal-ui", "window-controls-overlay"],
            orientation: "portrait",
            background_color: "#ffffff",
            theme_color: isDev ? "#7c3aed" : "#2563eb",
            categories: ["business", "productivity", "utilities"],
            dir: "ltr",
            lang: "en-US",
            prefer_related_applications: false,
            launch_handler: {
              client_mode: ["navigate-existing", "auto"]
            },
            icons: [
              { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
              { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
              { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
              { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
              { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
            ],
            screenshots: [
              { src: "/screenshots/login.png", sizes: "1000x1000", type: "image/png", form_factor: "narrow", label: "Staff Login" },
              { src: "/screenshots/login_mobile.png", sizes: "375x812", type: "image/png", form_factor: "narrow", label: "Staff Mobile Portal" }
            ],
            shortcuts: [
              { name: "Mark Attendance", short_name: "Mark", description: "Quickly mark staff attendance", url: "/staff/mark-attendance", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
              { name: "Attendance History", short_name: "History", description: "View past attendance records", url: "/staff/attendance-history", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }
            ]
          };
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(manifestData, null, 2));
          return;
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dynamicPwaManifestPlugin(),
  ],
  server: {
    port: 5174,
  }
})
