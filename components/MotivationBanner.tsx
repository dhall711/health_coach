"use client";

interface MotivationBannerProps {
  poundsLost: number;
  poundsToGo: number;
}

export default function MotivationBanner({ poundsLost, poundsToGo }: MotivationBannerProps) {
  // Weight milestone messages
  const getMilestoneMessage = () => {
    if (poundsLost >= 35) return "You've lost 35 lbs -- that's your 2017-2020 best! Keep going!";
    if (poundsLost >= 30) return "30 lbs gone -- almost matching your personal best!";
    if (poundsLost >= 25) return "25 lbs lost -- that's like carrying around a car tire!";
    if (poundsLost >= 20) return "20 lbs down -- that's a car tire worth of weight gone!";
    if (poundsLost >= 15) return "15 lbs lost -- that's a bowling ball you're no longer carrying!";
    if (poundsLost >= 10) return "10 lbs down! That's like shedding a bag of potatoes!";
    if (poundsLost >= 5) return "5 lbs lost -- great start! You're building momentum.";
    if (poundsLost > 0) return "Every pound counts. You're on your way!";
    return null;
  };

  const milestone = getMilestoneMessage();

  if (!milestone && poundsToGo > 30) {
    // Encouragement for early days
    return (
      <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border border-indigo-700/30 rounded-xl p-4 mb-4">
        <p className="text-sm text-indigo-200">
          💪 You&apos;ve done this before -- 35 lbs from 2017-2020. You can absolutely do it again.
          One day at a time.
        </p>
      </div>
    );
  }

  if (milestone) {
    return (
      <div className="bg-gradient-to-r from-green-900/50 to-emerald-900/50 border border-green-700/30 rounded-xl p-4 mb-4">
        <p className="text-sm text-green-200">🎉 {milestone}</p>
      </div>
    );
  }

  return null;
}
