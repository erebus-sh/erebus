"use client";

import { Grid } from "react-loader-spinner";

export default function Spinner({
  size = "small",
}: {
  size?: "small" | "default";
}) {
  // Define size mapping
  const sizeMap = {
    small: { height: 32, width: 32, radius: "10" },
    default: { height: 80, width: 80, radius: "12.5" },
  };
  const { height, width, radius } = sizeMap[size] || sizeMap.small;

  return (
    <Grid
      visible={true}
      height={height}
      width={width}
      color="#FAFAFA"
      ariaLabel="grid-loading"
      radius={radius}
      wrapperStyle={{}}
      wrapperClass="grid-wrapper"
    />
  );
}
