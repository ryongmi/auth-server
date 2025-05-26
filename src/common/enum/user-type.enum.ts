export enum UserType {
  GOOGLE = "google",
  NAVER = "naver",
  HOMEPAGE = "homePage",
  INTEGRATE = "integrate",
}

// 배열이 필요할 때 사용하도록 따로 export
export const USER_TYPE_VALUES = Object.values(UserType);
