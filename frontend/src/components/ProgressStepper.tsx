import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Check, CircleDashed, CircleDot, AlertCircle } from 'lucide-react'

interface ProgressStepperProps {
  currentRound: number;
  status: 'idle' | 'streaming' | 'completed' | 'error';
  nextAction: string | null;
  error: string | null;
}

export function ProgressStepper({ currentRound, status, nextAction, error }: ProgressStepperProps) {
  const steps = [
    { id: 1, label: 'Thu thập góc nhìn' },
    { id: 2, label: 'Tranh luận' },
    { id: 3, label: 'Đào sâu' },
    { id: 4, label: 'Chủ Tọa: Đúc kết' }
  ];

  // Calculate the active step based on currentRound and nextAction
  let activeStep = 1;
  if (currentRound === 1) {
    if (nextAction === 'round_2') activeStep = 2; // Transitioning to round 2
    else activeStep = 1; // Still in round 1
  } else if (currentRound === 2) {
    if (nextAction === 'round_3') activeStep = 3;
    else if (nextAction === 'moderator') activeStep = 4;
    else activeStep = 2;
  } else if (currentRound >= 3) {
    if (nextAction === 'moderator') activeStep = 4;
    else activeStep = 3;
  }

  // If completed but somehow stepper is still mounted, active step is 4
  if (status === 'completed') activeStep = 4;

  let progressWidth = '0%';
  if (activeStep === 1) progressWidth = '15%';
  else if (activeStep === 2) progressWidth = '40%';
  else if (activeStep === 3) progressWidth = '70%';
  else if (activeStep === 4) progressWidth = '100%';

  return (
    <div className="w-full max-w-3xl mx-auto py-6 px-4">
      <div className="relative flex justify-between items-center">
        {/* Connecting Lines */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-white/10 rounded-full z-0 pointer-events-none" />
        
        {/* Dynamic active line */}
        <motion.div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-500 rounded-full z-0 pointer-events-none"
          initial={{ width: '0%' }}
          animate={{ 
            width: progressWidth,
            backgroundColor: status === 'error' ? 'rgb(239, 68, 68)' : 'rgb(59, 130, 246)'
          }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />

        {steps.map((step) => {
          const isSkipped = step.id === 3 && currentRound < 3 && activeStep > 3;
          const isPast = activeStep > step.id && !isSkipped;
          const isActive = activeStep === step.id && status !== 'error';
          const isError = activeStep === step.id && status === 'error';

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-3">
              <motion.div 
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 backdrop-blur-md transition-colors duration-300",
                  isActive ? "bg-blue-500/20 border-blue-400 text-blue-300 shadow-[0_0_15px_rgba(96,165,250,0.5)]" :
                  isError ? "bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)]" :
                  isPast ? "bg-green-500/20 border-green-500 text-green-400" :
                  "bg-slate-800/50 border-slate-600 text-slate-500"
                )}
                animate={{
                  scale: isActive || isError ? 1.1 : 1,
                }}
              >
                {isError ? (
                  <AlertCircle className="w-5 h-5" />
                ) : isPast ? (
                  <Check className="w-5 h-5" />
                ) : isActive ? (
                  <CircleDot className="w-5 h-5 animate-pulse" />
                ) : (
                  <CircleDashed className="w-5 h-5" />
                )}
              </motion.div>
              
              <div className="flex flex-col items-center">
                <span className={cn(
                  "text-sm font-medium transition-colors duration-300 whitespace-nowrap",
                  isActive ? "text-blue-300" :
                  isError ? "text-red-400" :
                  isPast ? "text-slate-300" :
                  isSkipped ? "text-slate-600 line-through decoration-slate-600" :
                  "text-slate-500"
                )}>
                  {step.label}
                </span>
                {isSkipped && (
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">
                    Bỏ qua
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Show Error Message directly below if it occurred */}
      {status === 'error' && error && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 bg-red-500/10 border border-red-500/50 p-4 rounded-xl flex items-start gap-3 w-full text-center"
        >
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5 mx-auto" />
          <p className="text-red-200 text-sm text-left flex-1">{error}</p>
        </motion.div>
      )}
    </div>
  )
}
