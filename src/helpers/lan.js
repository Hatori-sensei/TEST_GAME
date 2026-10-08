// LAN 연동(통합 랭킹 / 대전). 4단계에서 실제 통신을 붙이기 전까지는
// "LAN 사용 안 함" 상태로 동작한다 → 모든 함수가 로컬 동작에 영향을 주지 않음.

// 통합 기록 가져오기. LAN 미사용/실패면 null(호출 측이 로컬 기록으로 폴백)
export async function fetchSharedRecords() {
  return null;
}

// 기록 등록 시 호스트에도 전송. LAN 미사용이면 아무것도 안 함
export async function postSharedRecord() {
  return false;
}

// 통합 기록 초기화(관리자). LAN 미사용이면 아무것도 안 함
export async function clearSharedRecords() {
  return false;
}
