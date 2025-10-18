## Installed Package
```bash
# pnpm ls   <-- 이걸로 확인가능
# typeorm, bcryptjs,config,typeorm-extension,dotenv, passport-jwt, types/passport-jwt등 깔면된다
dependencies:
@aws-sdk/client-s3            3.907.0     @nestjs/cache-manager          3.0.1       @nestjs/platform-socket.io     11.1.6      cache-manager                  7.2.0
@aws-sdk/s3-request-presigner 3.907.0     @nestjs/common                 11.1.6      @nestjs/swagger                11.2.0      cross-env                      10.0.0
@nestjs-modules/ioredis       2.0.2       @nestjs/config                 4.0.2       @nestjs/typeorm                11.0.0      dotenv                         16.6.1
@nestjs/axios                 4.0.1       @nestjs/core                   11.1.6      @nestjs/websockets             11.1.6      ioredis                        5.7.0
@nestjs/jwt                   11.0.0      @nestjs/mapped-types           2.1.0       axios                          1.12.2      joi                            17.13.3
@nestjs/passport              11.0.5      bcryptjs                       3.0.2       nanoid                         5.1.6       passport-jwt                   4.0.1
pg                            8.16.3      redis                          5.8.2       reflect-metadata               0.2.2       rxjs                           7.8.2
socket.io                     4.8.1       typeorm                        0.3.26      typeorm-extension              3.7.1       typeorm-naming-strategies      4.1.0
typeorm-transactional         0.5.0       uuid                           11.1.0

devDependencies:
@faker-js/faker               9.9.0       @nestjs/cli                    11.0.10     @nestjs/schematics             11.0.7      @nestjs/testing                11.1.6
@golevelup/ts-jest            0.7.0       @swc/cli                       0.6.0       @swc/core                      1.13.5      @types/express                 5.0.3
@types/jest                   29.5.14     @types/node                    22.18.0     @types/passport                1.0.17      @types/passport-jwt            4.0.1
@types/supertest              6.0.3       @typescript-eslint/eslint-plugin 6.0.0     @typescript-eslint/parser      6.0.0       class-transformer              0.5.1
class-validator               0.14.2      eslint                         8.42.0      eslint-config-prettier         10.1.8      eslint-plugin-prettier         5.5.4
globals                       16.3.0      jest                           29.7.0      prettier                       3.6.2       socket.io-client               4.8.1
source-map-support            0.5.21      supertest                      7.1.4       ts-jest                        29.4.1      ts-loader                      9.5.4
ts-node                       10.9.2      tsconfig-paths                 4.2.0       typescript                     5.9.2
```

## 의존성 설치 및 마아그레이션션 => DB를 수정할때마다 revert 후에 다시 생성 및 시작 
```bash
# 의존성 설치 및 마이그레이션
pnpm install
pnpm build
pnpm run migraiton:generate
pnpm run migration:run


# 마이그레이션 롤백
pnpm run migration:revert

```
## 마이그레이션
```bash
# 마이그레이션 생성 (Entity 변경 후)
pnpm run migration:generate

# 마이그레이션 실행
pnpm run migration:run

# 마이그레이션 롤백
pnpm run migration:revert
```

## DB
```bash
.env.example에서 바꿔야하는 부분을 수정 
NODE_ENV는 자신이 만들 env.sample에서 sample 부분을 경로 지정하는 것  
post는 자기가 설정한 포트로
postgresql 부분과 DATABASE_DBNAME 수정
DB쪽은 database까지만 만들면 나머지는 마이그레이션을 통해 생성
JWT_SECRE => 여기서는는 임의로 작성 ex) dffe#@WWQ23d
추가사항
```
