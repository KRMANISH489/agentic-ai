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
      <span className="logo-3d">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} style={{ ["--z" as string]: i }} />
        ))}
      </span>
    </span>
  );
}
