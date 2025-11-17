#!/bin/bash

set -e

KEY_DIR="./keys"

# 키 디렉토리 생성
mkdir -p "$KEY_DIR"

generate_keys() {
  local name=$1
  local private_key="$KEY_DIR/${name}-private.key"
  local public_key="$KEY_DIR/${name}-public.key"

  echo "🔐 Generating ${name} key pair..."

  # 개인키 생성
  openssl genrsa -out "$private_key" 2048

  # 공개키 추출
  openssl rsa -in "$private_key" -pubout -out "$public_key"

  echo "✅ ${name} key pair generated:"
  echo "   - $private_key"
  echo "   - $public_key"
  echo
}

generate_keys "access"
generate_keys "refresh"

echo "🎉 All JWT keys generated in '$KEY_DIR/'"


# 실행명령어 ./script/generate-jwt-keys.sh 