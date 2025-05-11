## Installed Package
```bash
# pnpm ls   <-- 이걸로 확인가능 typeorm, bcryptjs,config,typeorm-extension등 깔면된다
dependencies:
@nestjs/common 11.1.0            bcryptjs 3.0.2                   typeorm 0.3.23
@nestjs/config 4.0.2             joi 17.13.3                      typeorm-extension 3.7.1
@nestjs/core 11.1.0              pg 8.15.6                        typeorm-naming-strategies 4.1.0
@nestjs/platform-express 11.1.0  reflect-metadata 0.2.2
@nestjs/typeorm 11.0.0           rxjs 7.8.2

devDependencies:
@eslint/eslintrc 3.3.1         @types/node 22.15.17           prettier 3.5.3
@eslint/js 9.26.0              @types/supertest 6.0.3         source-map-support 0.5.21
@nestjs/cli 11.0.7             class-transformer 0.5.1        supertest 7.1.0
@nestjs/schematics 11.0.5      class-validator 0.14.2         ts-jest 29.3.2
@nestjs/testing 11.1.0         eslint 9.26.0                  ts-loader 9.5.2
@swc/cli 0.6.0                 eslint-config-prettier 10.1.5  ts-node 10.9.2
@swc/core 1.11.24              eslint-plugin-prettier 5.4.0   tsconfig-paths 4.2.0
@types/express 5.0.1           globals 16.1.0                 typescript 5.8.3
@types/jest 29.5.14            jest 29.7.0                    typescript-eslint 8.32.0
```

## 의존성 설치 및 마아그레이션션
```bash
pnpm install
pnpm run migraiton:generate
pnpm run migration:run

# 마이그레이션 롤백
pnpm run migration:revert

```

## DB
```bash
.env.example에서 바꿔야하는 부분을 수정 

post는 자기가 설정한 포트로
postgresql 부분과 DATABASE_DBNAME 수정
DB쪽은 database까지만 만들면 나머지는 마이그레이션을 통해 생성
```