"use client";

export function Logo({
  large = false,
  thinking = false,
  twinkle = false,
}: {
  large?: boolean;
  thinking?: boolean;
  twinkle?: boolean;
}) {
  return (
    <span
      className={`logo ${large ? "logo-lg" : ""} ${thinking ? "is-thinking" : ""}`}
      aria-hidden
    >
      {twinkle ? (
        <>
          <span className="twinkle t1" />
          <span className="twinkle t2" />
          <span className="twinkle t3" />
        </>
      ) : null}
      <img
        className="logo-bot bot-leap"
        src="/logo-bot.png"
        alt=""
        width={80}
        height={88}
        draggable={false}
      />
    </span>
  );
}
