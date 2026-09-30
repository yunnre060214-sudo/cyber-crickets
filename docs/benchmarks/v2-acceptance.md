# Cyber Crickets 2.0 实测验收

时间：2026-09-30T18:14:35.155Z。完成 148/148，执行错误 0。
源码 SHA256：276a556fedc5732276f2365afe3e5e76e47226127bcb3ff33985c4faeb067dd6；构建目录：276a556fedc5。
环境：v24.21.0 / linux / AMD EPYC 9V45 96-Core Processor。

固定矩阵：8 个独立种子 × 4 地图 × 4 出生位 × 60 秒，另有 180/400 秒各 4 局，三个新策略对 strongest 各 2 种子换边共 12 局。种子在源码冻结后生成，本次没有按结果调参。

128 局四方第一名次数（同分分别计入）：strongest 100，pathfinder 8，boundary 0，ucb 20。

这不是样本外必胜或相对 1.0 提升百分比的证据；地图与策略组合限定了适用范围。播放速度与机器耗时不进入结果。完整配置、得分、败局、哈希和每局实测时间见 JSON。

## 逐局结果

| 局 | 地图 | 时长 | 轮换 | 第一名 | 各方 VP |
|---|---|---:|---:|---|---|
| holdout/0 | plain | 60 | 0 | strongest | strongest 91.797 / ucb 58.720 / boundary 31.271 / pathfinder 24.530 |
| holdout/1 | plain | 60 | 1 | pathfinder | pathfinder 85.542 / strongest 63.407 / boundary 33.037 / ucb 24.212 |
| holdout/2 | plain | 60 | 2 | strongest | strongest 108.159 / pathfinder 37.613 / boundary 30.357 / ucb 28.877 |
| holdout/3 | plain | 60 | 3 | strongest | strongest 125.757 / ucb 56.899 / boundary 31.317 / pathfinder 29.944 |
| holdout/4 | basin | 60 | 0 | ucb | ucb 58.278 / strongest 40.549 / pathfinder 25.898 / boundary 20.997 |
| holdout/5 | basin | 60 | 1 | pathfinder | pathfinder 81.451 / ucb 46.299 / strongest 43.909 / boundary 27.063 |
| holdout/6 | basin | 60 | 2 | pathfinder | pathfinder 67.144 / strongest 60.756 / ucb 31.302 / boundary 28.030 |
| holdout/7 | basin | 60 | 3 | pathfinder | pathfinder 64.600 / strongest 64.558 / boundary 30.408 / ucb 29.713 |
| holdout/8 | canyon | 60 | 0 | strongest | strongest 114.912 / ucb 48.115 / pathfinder 42.866 / boundary 31.427 |
| holdout/9 | canyon | 60 | 1 | strongest | strongest 90.457 / pathfinder 48.440 / boundary 37.827 / ucb 33.996 |
| holdout/10 | canyon | 60 | 2 | strongest | strongest 90.146 / ucb 45.731 / pathfinder 40.648 / boundary 35.329 |
| holdout/11 | canyon | 60 | 3 | strongest | strongest 118.446 / ucb 49.842 / pathfinder 43.360 / boundary 27.128 |
| holdout/12 | ring | 60 | 0 | strongest | strongest 90.476 / ucb 62.012 / boundary 43.057 / pathfinder 26.007 |
| holdout/13 | ring | 60 | 1 | strongest | strongest 77.324 / pathfinder 69.031 / ucb 39.027 / boundary 23.159 |
| holdout/14 | ring | 60 | 2 | strongest | strongest 132.597 / ucb 39.529 / boundary 39.347 / pathfinder 32.403 |
| holdout/15 | ring | 60 | 3 | ucb | ucb 58.269 / strongest 45.812 / boundary 29.273 / pathfinder 23.249 |
| holdout/16 | plain | 60 | 0 | strongest | strongest 75.604 / ucb 55.740 / boundary 40.120 / pathfinder 13.678 |
| holdout/17 | plain | 60 | 1 | strongest | strongest 66.053 / ucb 54.513 / pathfinder 41.839 / boundary 35.145 |
| holdout/18 | plain | 60 | 2 | strongest | strongest 84.985 / pathfinder 53.903 / ucb 38.642 / boundary 25.647 |
| holdout/19 | plain | 60 | 3 | strongest | strongest 65.172 / pathfinder 45.955 / ucb 32.620 / boundary 27.723 |
| holdout/20 | basin | 60 | 0 | strongest | strongest 59.773 / ucb 58.235 / boundary 39.140 / pathfinder 19.367 |
| holdout/21 | basin | 60 | 1 | ucb | ucb 61.486 / strongest 59.802 / pathfinder 47.162 / boundary 25.850 |
| holdout/22 | basin | 60 | 2 | strongest | strongest 73.517 / pathfinder 70.841 / ucb 34.493 / boundary 22.980 |
| holdout/23 | basin | 60 | 3 | strongest | strongest 65.490 / pathfinder 64.209 / ucb 32.991 / boundary 26.698 |
| holdout/24 | canyon | 60 | 0 | strongest | strongest 77.113 / ucb 65.335 / boundary 43.862 / pathfinder 34.654 |
| holdout/25 | canyon | 60 | 1 | strongest | strongest 79.940 / ucb 65.033 / pathfinder 42.970 / boundary 41.259 |
| holdout/26 | canyon | 60 | 2 | strongest | strongest 82.841 / pathfinder 61.787 / ucb 56.957 / boundary 39.389 |
| holdout/27 | canyon | 60 | 3 | strongest | strongest 75.432 / pathfinder 44.852 / ucb 43.055 / boundary 36.946 |
| holdout/28 | ring | 60 | 0 | ucb | ucb 82.911 / strongest 68.676 / boundary 47.039 / pathfinder 39.914 |
| holdout/29 | ring | 60 | 1 | strongest | strongest 96.559 / ucb 67.680 / pathfinder 40.637 / boundary 40.056 |
| holdout/30 | ring | 60 | 2 | strongest | strongest 86.719 / ucb 53.378 / pathfinder 50.047 / boundary 27.651 |
| holdout/31 | ring | 60 | 3 | strongest | strongest 85.509 / ucb 39.683 / pathfinder 39.554 / boundary 30.555 |
| holdout/32 | plain | 60 | 0 | ucb | ucb 59.584 / strongest 57.005 / pathfinder 53.435 / boundary 36.354 |
| holdout/33 | plain | 60 | 1 | strongest | strongest 78.073 / pathfinder 68.739 / boundary 42.382 / ucb 23.648 |
| holdout/34 | plain | 60 | 2 | strongest | strongest 103.475 / ucb 46.873 / pathfinder 46.038 / boundary 22.734 |
| holdout/35 | plain | 60 | 3 | strongest | strongest 94.673 / boundary 34.396 / ucb 30.034 / pathfinder 28.014 |
| holdout/36 | basin | 60 | 0 | ucb | ucb 68.934 / strongest 63.078 / boundary 39.635 / pathfinder 18.196 |
| holdout/37 | basin | 60 | 1 | ucb | ucb 58.082 / strongest 51.572 / pathfinder 46.119 / boundary 33.062 |
| holdout/38 | basin | 60 | 2 | strongest | strongest 75.361 / pathfinder 47.098 / ucb 45.032 / boundary 22.844 |
| holdout/39 | basin | 60 | 3 | strongest | strongest 73.943 / boundary 34.505 / ucb 31.568 / pathfinder 26.825 |
| holdout/40 | canyon | 60 | 0 | ucb | ucb 56.480 / pathfinder 47.649 / strongest 44.361 / boundary 36.082 |
| holdout/41 | canyon | 60 | 1 | strongest | strongest 80.228 / boundary 46.228 / pathfinder 45.673 / ucb 36.921 |
| holdout/42 | canyon | 60 | 2 | strongest | strongest 73.596 / ucb 48.031 / boundary 35.415 / pathfinder 32.105 |
| holdout/43 | canyon | 60 | 3 | strongest | strongest 85.949 / pathfinder 50.773 / ucb 38.526 / boundary 31.865 |
| holdout/44 | ring | 60 | 0 | ucb | ucb 66.937 / strongest 57.666 / boundary 41.407 / pathfinder 15.262 |
| holdout/45 | ring | 60 | 1 | strongest | strongest 73.692 / pathfinder 64.552 / ucb 49.547 / boundary 30.791 |
| holdout/46 | ring | 60 | 2 | strongest | strongest 113.599 / pathfinder 44.720 / ucb 43.268 / boundary 32.709 |
| holdout/47 | ring | 60 | 3 | strongest | strongest 113.776 / ucb 40.391 / boundary 36.324 / pathfinder 27.401 |
| holdout/48 | plain | 60 | 0 | strongest | strongest 117.830 / ucb 41.343 / boundary 29.741 / pathfinder 26.614 |
| holdout/49 | plain | 60 | 1 | strongest | strongest 117.926 / ucb 43.430 / pathfinder 30.868 / boundary 28.987 |
| holdout/50 | plain | 60 | 2 | strongest | strongest 125.796 / ucb 45.436 / pathfinder 31.468 / boundary 28.082 |
| holdout/51 | plain | 60 | 3 | strongest | strongest 119.074 / ucb 57.135 / pathfinder 31.823 / boundary 25.320 |
| holdout/52 | basin | 60 | 0 | strongest | strongest 63.338 / pathfinder 38.984 / ucb 33.670 / boundary 29.741 |
| holdout/53 | basin | 60 | 1 | pathfinder | pathfinder 48.892 / strongest 45.920 / boundary 33.337 / ucb 23.194 |
| holdout/54 | basin | 60 | 2 | ucb | ucb 59.427 / strongest 46.067 / pathfinder 39.133 / boundary 26.328 |
| holdout/55 | basin | 60 | 3 | strongest | strongest 74.323 / ucb 72.230 / pathfinder 40.370 / boundary 25.155 |
| holdout/56 | canyon | 60 | 0 | strongest | strongest 78.364 / pathfinder 67.869 / ucb 39.933 / boundary 36.147 |
| holdout/57 | canyon | 60 | 1 | strongest | strongest 97.379 / boundary 49.832 / ucb 47.968 / pathfinder 44.507 |
| holdout/58 | canyon | 60 | 2 | strongest | strongest 105.214 / ucb 50.410 / boundary 37.263 / pathfinder 32.706 |
| holdout/59 | canyon | 60 | 3 | strongest | strongest 86.870 / ucb 68.225 / pathfinder 49.958 / boundary 28.235 |
| holdout/60 | ring | 60 | 0 | strongest | strongest 91.003 / ucb 53.888 / boundary 32.292 / pathfinder 25.295 |
| holdout/61 | ring | 60 | 1 | strongest | strongest 99.852 / ucb 36.730 / boundary 28.964 / pathfinder 25.144 |
| holdout/62 | ring | 60 | 2 | strongest | strongest 112.178 / ucb 38.460 / boundary 28.012 / pathfinder 27.141 |
| holdout/63 | ring | 60 | 3 | ucb | ucb 67.832 / strongest 48.065 / pathfinder 44.356 / boundary 27.415 |
| holdout/64 | plain | 60 | 0 | strongest | strongest 64.546 / ucb 61.474 / boundary 38.191 / pathfinder 37.774 |
| holdout/65 | plain | 60 | 1 | strongest | strongest 99.437 / pathfinder 55.473 / ucb 50.127 / boundary 28.762 |
| holdout/66 | plain | 60 | 2 | strongest | strongest 109.895 / ucb 50.328 / boundary 28.333 / pathfinder 17.979 |
| holdout/67 | plain | 60 | 3 | strongest | strongest 125.169 / pathfinder 36.441 / ucb 35.139 / boundary 28.459 |
| holdout/68 | basin | 60 | 0 | ucb | ucb 80.812 / strongest 53.590 / boundary 38.848 / pathfinder 21.676 |
| holdout/69 | basin | 60 | 1 | ucb | ucb 67.440 / strongest 57.919 / pathfinder 50.988 / boundary 29.286 |
| holdout/70 | basin | 60 | 2 | strongest | strongest 81.890 / pathfinder 49.737 / ucb 31.884 / boundary 23.373 |
| holdout/71 | basin | 60 | 3 | strongest | strongest 65.424 / pathfinder 46.392 / ucb 35.470 / boundary 28.440 |
| holdout/72 | canyon | 60 | 0 | strongest | strongest 98.362 / pathfinder 63.285 / ucb 51.485 / boundary 35.236 |
| holdout/73 | canyon | 60 | 1 | strongest | strongest 111.682 / pathfinder 58.062 / ucb 46.621 / boundary 38.072 |
| holdout/74 | canyon | 60 | 2 | strongest | strongest 82.703 / pathfinder 66.354 / ucb 51.002 / boundary 32.878 |
| holdout/75 | canyon | 60 | 3 | strongest | strongest 103.645 / pathfinder 56.111 / ucb 40.325 / boundary 37.181 |
| holdout/76 | ring | 60 | 0 | ucb | ucb 69.435 / strongest 39.953 / boundary 36.535 / pathfinder 33.852 |
| holdout/77 | ring | 60 | 1 | strongest | strongest 112.305 / ucb 46.454 / pathfinder 45.737 / boundary 29.312 |
| holdout/78 | ring | 60 | 2 | strongest | strongest 127.761 / ucb 40.547 / pathfinder 29.220 / boundary 29.154 |
| holdout/79 | ring | 60 | 3 | strongest | strongest 117.364 / ucb 46.105 / boundary 29.833 / pathfinder 21.344 |
| holdout/80 | plain | 60 | 0 | strongest | strongest 75.884 / ucb 65.427 / pathfinder 27.406 / boundary 27.217 |
| holdout/81 | plain | 60 | 1 | strongest | strongest 96.463 / ucb 61.548 / pathfinder 42.581 / boundary 26.584 |
| holdout/82 | plain | 60 | 2 | strongest | strongest 133.291 / pathfinder 42.886 / ucb 32.450 / boundary 27.961 |
| holdout/83 | plain | 60 | 3 | strongest | strongest 85.500 / pathfinder 40.320 / ucb 33.047 / boundary 26.217 |
| holdout/84 | basin | 60 | 0 | strongest | strongest 60.981 / pathfinder 55.782 / ucb 47.073 / boundary 27.217 |
| holdout/85 | basin | 60 | 1 | pathfinder | pathfinder 68.134 / strongest 61.848 / boundary 26.584 / ucb 24.512 |
| holdout/86 | basin | 60 | 2 | ucb | ucb 56.111 / strongest 51.603 / boundary 29.957 / pathfinder 20.629 |
| holdout/87 | basin | 60 | 3 | strongest | strongest 75.705 / ucb 57.925 / boundary 26.074 / pathfinder 25.902 |
| holdout/88 | canyon | 60 | 0 | strongest | strongest 76.987 / ucb 67.100 / boundary 38.475 / pathfinder 17.263 |
| holdout/89 | canyon | 60 | 1 | strongest | strongest 95.970 / ucb 60.883 / pathfinder 47.971 / boundary 31.722 |
| holdout/90 | canyon | 60 | 2 | strongest | strongest 110.458 / pathfinder 68.092 / ucb 34.751 / boundary 29.777 |
| holdout/91 | canyon | 60 | 3 | strongest | strongest 92.921 / pathfinder 37.417 / ucb 32.818 / boundary 32.711 |
| holdout/92 | ring | 60 | 0 | ucb | ucb 78.755 / strongest 61.523 / boundary 29.032 / pathfinder 25.465 |
| holdout/93 | ring | 60 | 1 | strongest | strongest 96.212 / ucb 61.453 / pathfinder 47.463 / boundary 28.356 |
| holdout/94 | ring | 60 | 2 | strongest | strongest 113.404 / pathfinder 36.985 / ucb 34.204 / boundary 29.875 |
| holdout/95 | ring | 60 | 3 | strongest | strongest 86.268 / pathfinder 37.138 / ucb 32.363 / boundary 27.965 |
| holdout/96 | plain | 60 | 0 | strongest | strongest 91.144 / ucb 59.911 / boundary 29.938 / pathfinder 18.924 |
| holdout/97 | plain | 60 | 1 | strongest | strongest 101.689 / ucb 65.161 / pathfinder 29.946 / boundary 24.283 |
| holdout/98 | plain | 60 | 2 | strongest | strongest 127.525 / pathfinder 45.243 / ucb 29.346 / boundary 25.818 |
| holdout/99 | plain | 60 | 3 | strongest | strongest 87.313 / pathfinder 42.262 / ucb 35.968 / boundary 27.256 |
| holdout/100 | basin | 60 | 0 | ucb | ucb 77.860 / strongest 67.077 / boundary 33.001 / pathfinder 23.825 |
| holdout/101 | basin | 60 | 1 | ucb | ucb 71.460 / pathfinder 54.268 / strongest 41.870 / boundary 25.355 |
| holdout/102 | basin | 60 | 2 | strongest | strongest 68.304 / ucb 46.033 / pathfinder 42.702 / boundary 25.027 |
| holdout/103 | basin | 60 | 3 | pathfinder | pathfinder 50.495 / strongest 36.966 / boundary 28.158 / ucb 24.760 |
| holdout/104 | canyon | 60 | 0 | ucb | ucb 78.067 / strongest 64.357 / boundary 39.299 / pathfinder 18.356 |
| holdout/105 | canyon | 60 | 1 | strongest | strongest 81.915 / ucb 63.837 / pathfinder 48.213 / boundary 34.123 |
| holdout/106 | canyon | 60 | 2 | strongest | strongest 99.332 / ucb 50.618 / pathfinder 46.958 / boundary 28.091 |
| holdout/107 | canyon | 60 | 3 | strongest | strongest 89.019 / pathfinder 45.773 / ucb 38.100 / boundary 32.137 |
| holdout/108 | ring | 60 | 0 | strongest | strongest 84.882 / ucb 66.972 / boundary 31.731 / pathfinder 19.695 |
| holdout/109 | ring | 60 | 1 | strongest | strongest 108.656 / pathfinder 56.386 / ucb 32.456 / boundary 28.143 |
| holdout/110 | ring | 60 | 2 | strongest | strongest 123.958 / ucb 50.660 / boundary 27.588 / pathfinder 21.859 |
| holdout/111 | ring | 60 | 3 | strongest | strongest 131.690 / ucb 54.650 / pathfinder 31.120 / boundary 28.475 |
| holdout/112 | plain | 60 | 0 | strongest | strongest 105.702 / pathfinder 49.026 / ucb 44.351 / boundary 24.478 |
| holdout/113 | plain | 60 | 1 | strongest | strongest 68.050 / pathfinder 54.799 / boundary 47.772 / ucb 25.182 |
| holdout/114 | plain | 60 | 2 | strongest | strongest 93.295 / ucb 57.186 / pathfinder 28.356 / boundary 24.736 |
| holdout/115 | plain | 60 | 3 | strongest | strongest 92.673 / ucb 68.795 / boundary 40.431 / pathfinder 36.931 |
| holdout/116 | basin | 60 | 0 | strongest | strongest 74.766 / ucb 62.141 / pathfinder 44.759 / boundary 23.689 |
| holdout/117 | basin | 60 | 1 | pathfinder | pathfinder 59.692 / strongest 51.385 / boundary 46.477 / ucb 27.658 |
| holdout/118 | basin | 60 | 2 | strongest | strongest 70.548 / ucb 65.588 / boundary 24.562 / pathfinder 22.877 |
| holdout/119 | basin | 60 | 3 | ucb | ucb 78.402 / strongest 68.838 / pathfinder 47.644 / boundary 34.237 |
| holdout/120 | canyon | 60 | 0 | strongest | strongest 87.478 / ucb 62.460 / boundary 46.409 / pathfinder 28.905 |
| holdout/121 | canyon | 60 | 1 | strongest | strongest 96.950 / ucb 68.088 / boundary 50.623 / pathfinder 38.843 |
| holdout/122 | canyon | 60 | 2 | strongest | strongest 79.169 / ucb 56.638 / pathfinder 51.190 / boundary 38.180 |
| holdout/123 | canyon | 60 | 3 | strongest | strongest 73.150 / ucb 50.832 / boundary 45.491 / pathfinder 44.493 |
| holdout/124 | ring | 60 | 0 | strongest | strongest 96.749 / pathfinder 46.952 / ucb 43.938 / boundary 33.547 |
| holdout/125 | ring | 60 | 1 | strongest | strongest 77.074 / boundary 49.619 / ucb 45.688 / pathfinder 32.831 |
| holdout/126 | ring | 60 | 2 | strongest | strongest 94.871 / ucb 49.155 / pathfinder 30.446 / boundary 26.264 |
| holdout/127 | ring | 60 | 3 | strongest | strongest 93.483 / ucb 76.704 / boundary 43.139 / pathfinder 39.768 |
| long/128 | plain | 180 | 0 | strongest | strongest 498.750 / boundary 246.837 / ucb 226.326 / pathfinder 132.905 |
| long/129 | plain | 180 | 1 | strongest | strongest 380.935 / boundary 284.966 / pathfinder 181.278 / ucb 164.805 |
| long/130 | plain | 180 | 2 | strongest | strongest 406.538 / ucb 231.761 / boundary 165.696 / pathfinder 58.193 |
| long/131 | plain | 180 | 3 | strongest | strongest 578.746 / ucb 229.727 / boundary 153.080 / pathfinder 75.479 |
| long/132 | plain | 400 | 0 | strongest | strongest 1190.692 / boundary 1157.624 / ucb 634.045 / pathfinder 101.752 |
| long/133 | plain | 400 | 1 | boundary | boundary 1149.625 / ucb 811.372 / strongest 758.458 / pathfinder 215.295 |
| long/134 | plain | 400 | 2 | boundary | boundary 1236.664 / ucb 739.453 / strongest 704.184 / pathfinder 204.482 |
| long/135 | plain | 400 | 3 | strongest | strongest 1693.601 / ucb 781.588 / boundary 510.700 / pathfinder 53.409 |
| duel/136 | plain | 60 | 0 | strongest | strongest 92.825 / pathfinder 38.656 |
| duel/137 | plain | 60 | 0 | strongest | strongest 91.726 / pathfinder 43.131 |
| duel/138 | plain | 60 | 0 | strongest | strongest 112.953 / pathfinder 36.421 |
| duel/139 | plain | 60 | 0 | strongest | strongest 118.996 / pathfinder 39.093 |
| duel/140 | plain | 60 | 0 | strongest | strongest 128.388 / boundary 27.317 |
| duel/141 | plain | 60 | 0 | strongest | strongest 143.216 / boundary 30.054 |
| duel/142 | plain | 60 | 0 | strongest | strongest 119.790 / boundary 33.734 |
| duel/143 | plain | 60 | 0 | strongest | strongest 125.127 / boundary 34.821 |
| duel/144 | plain | 60 | 0 | strongest | strongest 98.826 / ucb 44.207 |
| duel/145 | plain | 60 | 0 | strongest | strongest 101.981 / ucb 44.089 |
| duel/146 | plain | 60 | 0 | strongest | strongest 107.925 / ucb 34.159 |
| duel/147 | plain | 60 | 0 | strongest | strongest 141.917 / ucb 43.427 |

## 执行错误

无。
