/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e'
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617'
        },
        // Glassmorphism overlay colors
        glass: {
          white: 'rgba(255, 255, 255, 0.05)',
          light: 'rgba(255, 255, 255, 0.1)',
          medium: 'rgba(255, 255, 255, 0.15)',
          heavy: 'rgba(255, 255, 255, 0.2)'
        },
        // Accent colors for highlights and glows
        accent: {
          blue: '#3b82f6',
          purple: '#8b5cf6',
          cyan: '#06b6d4',
          emerald: '#10b981'
        }
      },
      // Custom animations for micro-interactions
      animation: {
        // Fade animations
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-in-up': 'fadeInUp 0.4s ease-out',
        'fade-in-down': 'fadeInDown 0.4s ease-out',
        'fade-in-scale': 'fadeInScale 0.3s ease-out',
        'fade-out': 'fadeOut 0.2s ease-in',

        // Scale animations
        'scale-in': 'scaleIn 0.2s ease-out',
        'scale-out': 'scaleOut 0.15s ease-in',
        'scale-bounce': 'scaleBounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',

        // Slide animations
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'slide-in-up': 'slideInUp 0.3s ease-out',
        'slide-in-down': 'slideInDown 0.3s ease-out',
        'slide-out-right': 'slideOutRight 0.2s ease-in',
        'slide-out-left': 'slideOutLeft 0.2s ease-in',

        // Subtle hover animations
        'hover-lift': 'hoverLift 0.2s ease-out forwards',
        'hover-glow': 'hoverGlow 0.3s ease-out forwards',

        // Loading/progress animations
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
        'progress-indeterminate': 'progressIndeterminate 1.5s ease-in-out infinite',

        // Spring animations (Apple-style)
        'spring-bounce': 'springBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'spring-scale': 'springScale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',

        // Modal/overlay animations
        'modal-in': 'modalIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'modal-out': 'modalOut 0.2s ease-in',
        'backdrop-in': 'backdropIn 0.3s ease-out',
        'backdrop-out': 'backdropOut 0.2s ease-in',

        // Drag and drop
        'drop-target-pulse': 'dropTargetPulse 1s ease-in-out infinite',

        // Icon animations
        'icon-pop': 'iconPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'check-draw': 'checkDraw 0.3s ease-out forwards'
      },
      keyframes: {
        // Fade keyframes
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        fadeInScale: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' }
        },

        // Scale keyframes
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        scaleOut: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.9)', opacity: '0' }
        },
        scaleBounce: {
          '0%': { transform: 'scale(0.9)' },
          '50%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)' }
        },

        // Slide keyframes
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        slideInUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideInDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(20px)', opacity: '0' }
        },
        slideOutLeft: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(-20px)', opacity: '0' }
        },

        // Hover effect keyframes
        hoverLift: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-2px)' }
        },
        hoverGlow: {
          '0%': { boxShadow: '0 0 0 rgba(59, 130, 246, 0)' },
          '100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)' }
        },

        // Pulse/loading keyframes
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' }
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.6)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        progressIndeterminate: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' }
        },

        // Spring keyframes
        springBounce: {
          '0%': { transform: 'scale(0.95) translateY(5px)', opacity: '0' },
          '60%': { transform: 'scale(1.02) translateY(-2px)', opacity: '1' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' }
        },
        springScale: {
          '0%': { transform: 'scale(0.9)' },
          '60%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' }
        },

        // Modal keyframes
        modalIn: {
          '0%': { transform: 'scale(0.95) translateY(10px)', opacity: '0' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' }
        },
        modalOut: {
          '0%': { transform: 'scale(1) translateY(0)', opacity: '1' },
          '100%': { transform: 'scale(0.95) translateY(10px)', opacity: '0' }
        },
        backdropIn: {
          '0%': { opacity: '0', backdropFilter: 'blur(0px)' },
          '100%': { opacity: '1', backdropFilter: 'blur(8px)' }
        },
        backdropOut: {
          '0%': { opacity: '1', backdropFilter: 'blur(8px)' },
          '100%': { opacity: '0', backdropFilter: 'blur(0px)' }
        },

        // Drop target keyframes
        dropTargetPulse: {
          '0%, 100%': {
            borderColor: 'rgba(59, 130, 246, 0.5)',
            boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.4)'
          },
          '50%': {
            borderColor: 'rgba(59, 130, 246, 0.8)',
            boxShadow: '0 0 0 8px rgba(59, 130, 246, 0)'
          }
        },

        // Icon keyframes
        iconPop: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        checkDraw: {
          '0%': { strokeDashoffset: '100' },
          '100%': { strokeDashoffset: '0' }
        }
      },
      // Custom shadows for depth and hierarchy
      boxShadow: {
        // Subtle shadows for cards and panels
        'subtle': '0 1px 2px rgba(0, 0, 0, 0.05)',
        'soft': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'medium': '0 4px 12px rgba(0, 0, 0, 0.1)',
        'strong': '0 8px 24px rgba(0, 0, 0, 0.12)',
        'heavy': '0 12px 32px rgba(0, 0, 0, 0.15)',

        // Elevated shadows (for modals, dropdowns)
        'elevated-sm': '0 4px 16px rgba(0, 0, 0, 0.2)',
        'elevated': '0 8px 32px rgba(0, 0, 0, 0.25)',
        'elevated-lg': '0 16px 48px rgba(0, 0, 0, 0.3)',

        // Inner shadows for depth
        'inner-soft': 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
        'inner-medium': 'inset 0 2px 4px rgba(0, 0, 0, 0.15)',

        // Glow effects for focus/active states
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.4)',
        'glow-blue-lg': '0 0 40px rgba(59, 130, 246, 0.3)',
        'glow-purple': '0 0 20px rgba(139, 92, 246, 0.4)',
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.4)',
        'glow-emerald': '0 0 20px rgba(16, 185, 129, 0.4)',

        // Ring shadows for focus states
        'ring-primary': '0 0 0 3px rgba(59, 130, 246, 0.3)',
        'ring-white': '0 0 0 3px rgba(255, 255, 255, 0.1)',

        // Dark mode optimized shadows
        'dark-sm': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'dark-md': '0 4px 16px rgba(0, 0, 0, 0.4)',
        'dark-lg': '0 8px 32px rgba(0, 0, 0, 0.5)',
        'dark-xl': '0 16px 48px rgba(0, 0, 0, 0.6)'
      },
      // Backdrop blur for glassmorphism
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '24px',
        '3xl': '32px'
      },
      // Custom transition timing functions
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'smooth-out': 'cubic-bezier(0, 0, 0.2, 1)',
        'smooth-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
      },
      // Extended transition durations
      transitionDuration: {
        '0': '0ms',
        '50': '50ms',
        '100': '100ms',
        '150': '150ms',
        '200': '200ms',
        '250': '250ms',
        '300': '300ms',
        '400': '400ms',
        '500': '500ms',
        '600': '600ms',
        '700': '700ms',
        '800': '800ms'
      },
      // Border radius for consistent rounding
      borderRadius: {
        'subtle': '4px',
        'moderate': '8px',
        'smooth': '12px',
        'rounded': '16px',
        'pill': '9999px'
      },
      // Custom spacing for consistent layouts
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem'
      },
      // Background gradients
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'shimmer': 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
        'dark-gradient': 'linear-gradient(180deg, rgba(15,23,42,0.8) 0%, rgba(15,23,42,0.95) 100%)',
        'glow-gradient': 'radial-gradient(circle at center, rgba(59,130,246,0.15) 0%, transparent 70%)'
      },
      // Z-index scale for layering
      zIndex: {
        'dropdown': '100',
        'sticky': '200',
        'overlay': '300',
        'modal': '400',
        'popover': '500',
        'tooltip': '600',
        'toast': '700'
      }
    }
  },
  plugins: []
}
