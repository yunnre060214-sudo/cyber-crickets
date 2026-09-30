# Cyber Crickets 2.0 实测验收

时间：2026-09-30T16:24:59.173Z。完成 148/148，执行错误 0。
源码 SHA256：7358e4a14eeb967153b2865b7a3412bbd727454e0495797d11ef837de1517d87；构建目录：7358e4a14eeb。
环境：v24.19.0 / linux / INTEL(R) XEON(R) PLATINUM 8573C。

固定矩阵：8 个独立种子 × 4 地图 × 4 出生位 × 60 秒，另有 180/400 秒各 4 局，三个新策略对 strongest 各 2 种子换边共 12 局。种子在源码冻结后生成，本次没有按结果调参。

128 局四方第一名次数（同分分别计入）：strongest 102，pathfinder 10，boundary 0，ucb 16。

这不是样本外必胜或相对 1.0 提升百分比的证据；地图与策略组合限定了适用范围。播放速度与机器耗时不进入结果。完整配置、得分、败局、哈希和每局实测时间见 JSON。

## 逐局结果

| 局 | 地图 | 时长 | 轮换 | 第一名 | 各方 VP |
|---|---|---:|---:|---|---|
| holdout/0 | plain | 60 | 0 | strongest | strongest 114.675 / ucb 50.768 / pathfinder 47.458 / boundary 29.094 |
| holdout/1 | plain | 60 | 1 | strongest | strongest 95.419 / pathfinder 45.612 / ucb 35.954 / boundary 32.211 |
| holdout/2 | plain | 60 | 2 | strongest | strongest 95.811 / ucb 79.822 / boundary 31.508 / pathfinder 24.091 |
| holdout/3 | plain | 60 | 3 | strongest | strongest 101.257 / ucb 79.644 / pathfinder 34.444 / boundary 31.834 |
| holdout/4 | basin | 60 | 0 | ucb | ucb 62.942 / strongest 60.826 / boundary 30.768 / pathfinder 17.055 |
| holdout/5 | basin | 60 | 1 | strongest | strongest 75.907 / pathfinder 60.889 / ucb 42.394 / boundary 32.218 |
| holdout/6 | basin | 60 | 2 | ucb | ucb 66.890 / strongest 66.782 / pathfinder 40.853 / boundary 29.970 |
| holdout/7 | basin | 60 | 3 | strongest | strongest 92.120 / ucb 63.786 / pathfinder 45.764 / boundary 31.729 |
| holdout/8 | canyon | 60 | 0 | strongest | strongest 112.373 / ucb 50.133 / pathfinder 42.156 / boundary 35.820 |
| holdout/9 | canyon | 60 | 1 | strongest | strongest 88.827 / boundary 48.412 / pathfinder 39.702 / ucb 38.285 |
| holdout/10 | canyon | 60 | 2 | strongest | strongest 91.019 / ucb 68.428 / boundary 37.882 / pathfinder 25.789 |
| holdout/11 | canyon | 60 | 3 | strongest | strongest 108.431 / ucb 69.714 / boundary 35.325 / pathfinder 32.847 |
| holdout/12 | ring | 60 | 0 | strongest | strongest 113.921 / pathfinder 46.906 / ucb 38.042 / boundary 35.817 |
| holdout/13 | ring | 60 | 1 | strongest | strongest 111.745 / ucb 38.730 / boundary 33.948 / pathfinder 32.559 |
| holdout/14 | ring | 60 | 2 | strongest | strongest 107.084 / ucb 43.713 / boundary 34.555 / pathfinder 25.653 |
| holdout/15 | ring | 60 | 3 | strongest | strongest 110.870 / ucb 64.556 / pathfinder 34.166 / boundary 33.156 |
| holdout/16 | plain | 60 | 0 | strongest | strongest 100.042 / ucb 57.311 / boundary 40.352 / pathfinder 29.124 |
| holdout/17 | plain | 60 | 1 | strongest | strongest 100.807 / ucb 52.128 / pathfinder 34.187 / boundary 33.900 |
| holdout/18 | plain | 60 | 2 | strongest | strongest 105.652 / ucb 44.135 / boundary 34.260 / pathfinder 30.221 |
| holdout/19 | plain | 60 | 3 | strongest | strongest 104.721 / ucb 55.944 / pathfinder 41.714 / boundary 28.690 |
| holdout/20 | basin | 60 | 0 | ucb | ucb 71.909 / strongest 57.280 / boundary 40.231 / pathfinder 34.467 |
| holdout/21 | basin | 60 | 1 | strongest | strongest 60.713 / pathfinder 58.885 / ucb 36.891 / boundary 34.924 |
| holdout/22 | basin | 60 | 2 | strongest | strongest 52.568 / ucb 46.546 / pathfinder 42.759 / boundary 34.172 |
| holdout/23 | basin | 60 | 3 | strongest | strongest 81.793 / ucb 63.570 / pathfinder 49.581 / boundary 27.130 |
| holdout/24 | canyon | 60 | 0 | strongest | strongest 123.791 / boundary 45.042 / ucb 44.345 / pathfinder 35.637 |
| holdout/25 | canyon | 60 | 1 | strongest | strongest 110.775 / boundary 51.999 / ucb 49.053 / pathfinder 41.888 |
| holdout/26 | canyon | 60 | 2 | strongest | strongest 85.455 / ucb 55.724 / pathfinder 48.005 / boundary 43.594 |
| holdout/27 | canyon | 60 | 3 | strongest | strongest 110.178 / ucb 54.327 / pathfinder 39.718 / boundary 37.843 |
| holdout/28 | ring | 60 | 0 | strongest | strongest 99.022 / ucb 52.391 / pathfinder 46.468 / boundary 39.410 |
| holdout/29 | ring | 60 | 1 | strongest | strongest 95.600 / ucb 50.730 / pathfinder 37.771 / boundary 33.636 |
| holdout/30 | ring | 60 | 2 | strongest | strongest 106.826 / ucb 38.526 / boundary 35.370 / pathfinder 26.570 |
| holdout/31 | ring | 60 | 3 | strongest | strongest 100.094 / ucb 45.199 / pathfinder 33.142 / boundary 30.200 |
| holdout/32 | plain | 60 | 0 | strongest | strongest 65.345 / ucb 57.772 / boundary 38.808 / pathfinder 26.400 |
| holdout/33 | plain | 60 | 1 | strongest | strongest 99.212 / ucb 44.920 / pathfinder 38.893 / boundary 32.616 |
| holdout/34 | plain | 60 | 2 | strongest | strongest 129.687 / pathfinder 35.126 / ucb 31.917 / boundary 31.705 |
| holdout/35 | plain | 60 | 3 | strongest | strongest 103.150 / ucb 36.981 / boundary 29.841 / pathfinder 27.414 |
| holdout/36 | basin | 60 | 0 | ucb | ucb 73.964 / boundary 38.626 / pathfinder 32.672 / strongest 29.185 |
| holdout/37 | basin | 60 | 1 | ucb | ucb 58.815 / pathfinder 55.711 / strongest 37.429 / boundary 31.645 |
| holdout/38 | basin | 60 | 2 | pathfinder | pathfinder 67.377 / strongest 55.481 / ucb 38.327 / boundary 22.812 |
| holdout/39 | basin | 60 | 3 | pathfinder | pathfinder 64.481 / strongest 42.884 / boundary 29.861 / ucb 22.251 |
| holdout/40 | canyon | 60 | 0 | strongest | strongest 85.757 / ucb 46.256 / boundary 44.658 / pathfinder 38.677 |
| holdout/41 | canyon | 60 | 1 | strongest | strongest 95.898 / ucb 52.648 / pathfinder 41.295 / boundary 40.427 |
| holdout/42 | canyon | 60 | 2 | strongest | strongest 93.337 / pathfinder 64.239 / boundary 34.938 / ucb 29.059 |
| holdout/43 | canyon | 60 | 3 | strongest | strongest 86.907 / pathfinder 50.829 / ucb 43.037 / boundary 34.040 |
| holdout/44 | ring | 60 | 0 | strongest | strongest 79.375 / ucb 56.460 / boundary 40.339 / pathfinder 29.877 |
| holdout/45 | ring | 60 | 1 | strongest | strongest 105.595 / ucb 46.864 / pathfinder 39.249 / boundary 34.425 |
| holdout/46 | ring | 60 | 2 | strongest | strongest 126.266 / ucb 36.156 / pathfinder 35.829 / boundary 34.196 |
| holdout/47 | ring | 60 | 3 | strongest | strongest 91.346 / ucb 41.261 / boundary 31.666 / pathfinder 28.520 |
| holdout/48 | plain | 60 | 0 | strongest | strongest 103.567 / ucb 46.359 / pathfinder 45.474 / boundary 24.917 |
| holdout/49 | plain | 60 | 1 | strongest | strongest 74.201 / boundary 36.960 / pathfinder 36.273 / ucb 32.331 |
| holdout/50 | plain | 60 | 2 | strongest | strongest 75.498 / ucb 58.139 / boundary 28.954 / pathfinder 12.220 |
| holdout/51 | plain | 60 | 3 | ucb | ucb 82.289 / strongest 74.475 / pathfinder 39.442 / boundary 28.271 |
| holdout/52 | basin | 60 | 0 | strongest | strongest 83.313 / pathfinder 44.318 / ucb 42.569 / boundary 24.818 |
| holdout/53 | basin | 60 | 1 | strongest | strongest 64.391 / pathfinder 41.833 / boundary 36.960 / ucb 25.802 |
| holdout/54 | basin | 60 | 2 | strongest | strongest 54.721 / ucb 51.827 / boundary 27.876 / pathfinder 11.930 |
| holdout/55 | basin | 60 | 3 | ucb | ucb 73.876 / strongest 60.405 / pathfinder 59.811 / boundary 28.548 |
| holdout/56 | canyon | 60 | 0 | strongest | strongest 83.731 / ucb 42.584 / boundary 41.910 / pathfinder 29.236 |
| holdout/57 | canyon | 60 | 1 | strongest | strongest 85.305 / ucb 62.977 / pathfinder 46.784 / boundary 32.573 |
| holdout/58 | canyon | 60 | 2 | strongest | strongest 97.519 / pathfinder 65.419 / ucb 45.173 / boundary 31.566 |
| holdout/59 | canyon | 60 | 3 | strongest | strongest 89.748 / pathfinder 46.253 / ucb 36.491 / boundary 35.930 |
| holdout/60 | ring | 60 | 0 | strongest | strongest 83.886 / pathfinder 57.020 / boundary 33.778 / ucb 33.368 |
| holdout/61 | ring | 60 | 1 | pathfinder | pathfinder 75.976 / strongest 56.521 / boundary 44.126 / ucb 23.471 |
| holdout/62 | ring | 60 | 2 | strongest | strongest 66.318 / ucb 38.239 / boundary 32.589 / pathfinder 14.311 |
| holdout/63 | ring | 60 | 3 | strongest | strongest 75.158 / ucb 59.207 / pathfinder 29.530 / boundary 29.391 |
| holdout/64 | plain | 60 | 0 | strongest | strongest 120.618 / ucb 46.292 / boundary 33.689 / pathfinder 31.725 |
| holdout/65 | plain | 60 | 1 | strongest | strongest 120.488 / ucb 45.787 / boundary 45.365 / pathfinder 32.265 |
| holdout/66 | plain | 60 | 2 | strongest | strongest 102.506 / ucb 46.022 / pathfinder 26.702 / boundary 23.045 |
| holdout/67 | plain | 60 | 3 | strongest | strongest 109.371 / ucb 62.476 / pathfinder 37.209 / boundary 33.768 |
| holdout/68 | basin | 60 | 0 | strongest | strongest 72.249 / ucb 54.813 / pathfinder 48.783 / boundary 27.345 |
| holdout/69 | basin | 60 | 1 | strongest | strongest 53.280 / pathfinder 48.068 / ucb 39.959 / boundary 38.638 |
| holdout/70 | basin | 60 | 2 | strongest | strongest 56.763 / ucb 45.770 / boundary 24.575 / pathfinder 21.895 |
| holdout/71 | basin | 60 | 3 | ucb | ucb 74.377 / strongest 65.239 / pathfinder 40.881 / boundary 33.665 |
| holdout/72 | canyon | 60 | 0 | strongest | strongest 100.166 / ucb 50.565 / boundary 49.481 / pathfinder 38.705 |
| holdout/73 | canyon | 60 | 1 | strongest | strongest 115.771 / ucb 45.430 / pathfinder 43.954 / boundary 43.768 |
| holdout/74 | canyon | 60 | 2 | strongest | strongest 121.257 / pathfinder 44.972 / boundary 43.030 / ucb 36.504 |
| holdout/75 | canyon | 60 | 3 | strongest | strongest 113.665 / pathfinder 43.614 / ucb 42.380 / boundary 40.684 |
| holdout/76 | ring | 60 | 0 | strongest | strongest 84.204 / ucb 69.031 / boundary 47.266 / pathfinder 36.413 |
| holdout/77 | ring | 60 | 1 | strongest | strongest 119.682 / ucb 51.489 / pathfinder 49.198 / boundary 43.262 |
| holdout/78 | ring | 60 | 2 | strongest | strongest 131.293 / pathfinder 43.866 / ucb 41.614 / boundary 35.240 |
| holdout/79 | ring | 60 | 3 | pathfinder | pathfinder 57.278 / strongest 56.161 / ucb 36.011 / boundary 34.354 |
| holdout/80 | plain | 60 | 0 | ucb | ucb 65.396 / strongest 60.404 / boundary 36.736 / pathfinder 7.756 |
| holdout/81 | plain | 60 | 1 | pathfinder | pathfinder 76.059 / ucb 53.984 / strongest 49.050 / boundary 36.077 |
| holdout/82 | plain | 60 | 2 | strongest | strongest 59.651 / ucb 54.841 / pathfinder 42.238 / boundary 26.458 |
| holdout/83 | plain | 60 | 3 | strongest | strongest 77.255 / pathfinder 43.255 / ucb 36.852 / boundary 35.209 |
| holdout/84 | basin | 60 | 0 | ucb | ucb 58.817 / strongest 45.877 / boundary 36.736 / pathfinder 6.888 |
| holdout/85 | basin | 60 | 1 | pathfinder | pathfinder 85.080 / ucb 53.737 / strongest 36.074 / boundary 33.010 |
| holdout/86 | basin | 60 | 2 | ucb | ucb 56.858 / strongest 50.736 / boundary 28.851 / pathfinder 27.199 |
| holdout/87 | basin | 60 | 3 | strongest | strongest 56.893 / ucb 47.719 / pathfinder 47.364 / boundary 35.179 |
| holdout/88 | canyon | 60 | 0 | strongest | strongest 82.179 / ucb 54.112 / boundary 35.015 / pathfinder 30.111 |
| holdout/89 | canyon | 60 | 1 | strongest | strongest 88.843 / ucb 40.213 / boundary 34.513 / pathfinder 34.511 |
| holdout/90 | canyon | 60 | 2 | strongest | strongest 57.737 / ucb 55.675 / boundary 33.140 / pathfinder 12.906 |
| holdout/91 | canyon | 60 | 3 | strongest | strongest 118.597 / ucb 39.424 / boundary 32.144 / pathfinder 31.842 |
| holdout/92 | ring | 60 | 0 | strongest | strongest 93.319 / ucb 40.400 / boundary 34.643 / pathfinder 23.283 |
| holdout/93 | ring | 60 | 1 | pathfinder | pathfinder 96.973 / ucb 52.619 / strongest 42.306 / boundary 25.232 |
| holdout/94 | ring | 60 | 2 | pathfinder | pathfinder 47.999 / strongest 39.059 / ucb 34.193 / boundary 27.744 |
| holdout/95 | ring | 60 | 3 | strongest | strongest 108.361 / ucb 45.476 / pathfinder 33.576 / boundary 33.498 |
| holdout/96 | plain | 60 | 0 | strongest | strongest 144.506 / ucb 47.068 / pathfinder 35.381 / boundary 27.720 |
| holdout/97 | plain | 60 | 1 | strongest | strongest 97.433 / pathfinder 60.293 / boundary 28.810 / ucb 24.874 |
| holdout/98 | plain | 60 | 2 | strongest | strongest 107.879 / ucb 63.766 / boundary 24.950 / pathfinder 18.853 |
| holdout/99 | plain | 60 | 3 | strongest | strongest 124.717 / ucb 59.321 / pathfinder 37.890 / boundary 26.494 |
| holdout/100 | basin | 60 | 0 | ucb | ucb 59.168 / strongest 49.751 / boundary 27.686 / pathfinder 23.851 |
| holdout/101 | basin | 60 | 1 | strongest | strongest 69.115 / pathfinder 55.575 / ucb 49.711 / boundary 28.135 |
| holdout/102 | basin | 60 | 2 | strongest | strongest 55.843 / ucb 49.473 / pathfinder 42.520 / boundary 25.783 |
| holdout/103 | basin | 60 | 3 | pathfinder | pathfinder 78.487 / strongest 56.548 / boundary 26.482 / ucb 25.418 |
| holdout/104 | canyon | 60 | 0 | strongest | strongest 116.168 / ucb 49.963 / boundary 44.021 / pathfinder 28.559 |
| holdout/105 | canyon | 60 | 1 | strongest | strongest 124.823 / ucb 43.050 / pathfinder 42.664 / boundary 40.607 |
| holdout/106 | canyon | 60 | 2 | strongest | strongest 98.539 / ucb 62.820 / boundary 38.863 / pathfinder 20.817 |
| holdout/107 | canyon | 60 | 3 | strongest | strongest 109.852 / ucb 57.564 / boundary 40.204 / pathfinder 31.731 |
| holdout/108 | ring | 60 | 0 | strongest | strongest 57.863 / ucb 51.755 / pathfinder 40.903 / boundary 25.855 |
| holdout/109 | ring | 60 | 1 | pathfinder | pathfinder 64.421 / strongest 51.849 / boundary 31.699 / ucb 29.341 |
| holdout/110 | ring | 60 | 2 | ucb | ucb 44.737 / strongest 42.520 / pathfinder 31.652 / boundary 22.743 |
| holdout/111 | ring | 60 | 3 | ucb | ucb 94.317 / strongest 50.651 / pathfinder 40.406 / boundary 27.120 |
| holdout/112 | plain | 60 | 0 | strongest | strongest 78.395 / ucb 71.539 / pathfinder 42.789 / boundary 39.498 |
| holdout/113 | plain | 60 | 1 | strongest | strongest 117.848 / pathfinder 51.531 / ucb 44.934 / boundary 39.570 |
| holdout/114 | plain | 60 | 2 | strongest | strongest 127.330 / pathfinder 44.627 / ucb 39.884 / boundary 30.639 |
| holdout/115 | plain | 60 | 3 | strongest | strongest 132.522 / pathfinder 45.458 / ucb 41.762 / boundary 25.216 |
| holdout/116 | basin | 60 | 0 | ucb | ucb 85.450 / strongest 61.285 / boundary 39.595 / pathfinder 16.372 |
| holdout/117 | basin | 60 | 1 | ucb | ucb 72.586 / strongest 53.891 / pathfinder 49.172 / boundary 36.136 |
| holdout/118 | basin | 60 | 2 | strongest | strongest 74.469 / ucb 52.591 / pathfinder 49.829 / boundary 30.335 |
| holdout/119 | basin | 60 | 3 | strongest | strongest 55.553 / pathfinder 44.622 / ucb 26.122 / boundary 25.463 |
| holdout/120 | canyon | 60 | 0 | strongest | strongest 83.969 / ucb 66.054 / boundary 51.223 / pathfinder 44.355 |
| holdout/121 | canyon | 60 | 1 | strongest | strongest 120.710 / ucb 50.776 / pathfinder 46.248 / boundary 43.689 |
| holdout/122 | canyon | 60 | 2 | strongest | strongest 118.251 / boundary 45.914 / pathfinder 45.893 / ucb 41.707 |
| holdout/123 | canyon | 60 | 3 | strongest | strongest 121.252 / ucb 45.297 / boundary 41.901 / pathfinder 38.747 |
| holdout/124 | ring | 60 | 0 | strongest | strongest 92.147 / ucb 63.653 / pathfinder 42.785 / boundary 40.869 |
| holdout/125 | ring | 60 | 1 | strongest | strongest 118.738 / pathfinder 55.879 / ucb 45.653 / boundary 41.973 |
| holdout/126 | ring | 60 | 2 | strongest | strongest 119.089 / pathfinder 43.876 / ucb 41.864 / boundary 35.790 |
| holdout/127 | ring | 60 | 3 | strongest | strongest 130.871 / pathfinder 55.085 / ucb 37.901 / boundary 30.793 |
| long/128 | plain | 180 | 0 | strongest | strongest 418.779 / boundary 279.775 / ucb 241.618 / pathfinder 102.175 |
| long/129 | plain | 180 | 1 | boundary | boundary 355.151 / ucb 245.838 / strongest 183.104 / pathfinder 166.576 |
| long/130 | plain | 180 | 2 | strongest | strongest 348.287 / ucb 210.286 / boundary 181.885 / pathfinder 48.639 |
| long/131 | plain | 180 | 3 | strongest | strongest 444.488 / ucb 269.637 / boundary 167.831 / pathfinder 75.892 |
| long/132 | plain | 400 | 0 | strongest | strongest 1199.458 / boundary 1154.119 / ucb 701.135 / pathfinder 210.922 |
| long/133 | plain | 400 | 1 | boundary | boundary 1185.809 / ucb 862.192 / strongest 631.367 / pathfinder 438.508 |
| long/134 | plain | 400 | 2 | boundary | boundary 1264.713 / strongest 790.833 / ucb 778.813 / pathfinder 151.998 |
| long/135 | plain | 400 | 3 | strongest | strongest 1747.419 / ucb 749.401 / boundary 594.323 / pathfinder 77.821 |
| duel/136 | plain | 60 | 0 | strongest | strongest 80.622 / pathfinder 45.918 |
| duel/137 | plain | 60 | 0 | strongest | strongest 76.694 / pathfinder 40.876 |
| duel/138 | plain | 60 | 0 | strongest | strongest 79.771 / pathfinder 46.709 |
| duel/139 | plain | 60 | 0 | strongest | strongest 85.454 / pathfinder 36.250 |
| duel/140 | plain | 60 | 0 | strongest | strongest 98.905 / boundary 34.194 |
| duel/141 | plain | 60 | 0 | strongest | strongest 95.894 / boundary 36.479 |
| duel/142 | plain | 60 | 0 | strongest | strongest 146.799 / boundary 38.902 |
| duel/143 | plain | 60 | 0 | strongest | strongest 145.257 / boundary 38.577 |
| duel/144 | plain | 60 | 0 | strongest | strongest 86.834 / ucb 39.353 |
| duel/145 | plain | 60 | 0 | strongest | strongest 80.922 / ucb 36.184 |
| duel/146 | plain | 60 | 0 | strongest | strongest 112.491 / ucb 41.536 |
| duel/147 | plain | 60 | 0 | strongest | strongest 110.654 / ucb 49.277 |

## 执行错误

无。
