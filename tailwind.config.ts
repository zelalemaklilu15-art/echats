import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		fontFamily: {
			sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
			display: ['Cinzel', 'ui-serif', 'Georgia', 'serif'],
		},
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					glow: 'hsl(var(--primary-glow))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				chat: {
					'bubble-incoming': 'hsl(var(--chat-bubble-incoming))',
					'bubble-outgoing': 'hsl(var(--chat-bubble-outgoing))',
					'text-incoming': 'hsl(var(--chat-bubble-text-incoming))',
					'text-outgoing': 'hsl(var(--chat-bubble-text-outgoing))'
				},
				status: {
					online: 'hsl(var(--online))',
					away: 'hsl(var(--away))',
					offline: 'hsl(var(--offline))'
				},
				'read-receipt': 'hsl(var(--read-receipt))',
				call: {
					accept: 'hsl(var(--call-accept))',
					'accept-foreground': 'hsl(var(--call-accept-foreground))'
				},
				surface: {
					lowest: 'hsl(var(--surface-lowest))',
					low: 'hsl(var(--surface-low))',
					DEFAULT: 'hsl(var(--surface))',
					high: 'hsl(var(--surface-high))',
					highest: 'hsl(var(--surface-highest))'
				},
				tertiary: {
					DEFAULT: 'hsl(var(--tertiary))',
					foreground: 'hsl(var(--tertiary-foreground))'
				},
				cosmic: {
					cyan: 'hsl(var(--cosmic-cyan))',
					mint: 'hsl(var(--cosmic-mint))',
					magenta: 'hsl(var(--cosmic-magenta))'
				}
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-hero': 'var(--gradient-hero)',
				'gradient-gold': 'var(--gradient-gold)'
			},
			boxShadow: {
				'primary': 'var(--shadow-primary)',
				'card': 'var(--shadow-card)'
			},
			transitionTimingFunction: {
				'smooth': 'var(--transition-smooth)',
				'bounce': 'var(--transition-bounce)'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
