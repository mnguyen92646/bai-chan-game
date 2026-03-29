export function BuildStamp(props: { className?: string }) {
  // generated at dev/build/start via scripts/generateBuildInfo.mjs
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const info = require("@/generated/buildInfo") as typeof import("@/generated/buildInfo");

  return (
    <div className={props.className ?? ""}>
      <span className="font-mono text-[10px] text-white/70">
        build {info.BUILD_SHA} @ {info.BUILD_TIME}
      </span>
    </div>
  );
}
