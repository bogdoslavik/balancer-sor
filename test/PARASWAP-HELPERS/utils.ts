import { parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { getAddress } from '@ethersproject/address';
import { BZERO, MathSol } from '../PARASWAP-CORE/basicOperations';
import { SubgraphPoolBase } from '../../src';

export const isSameAddress = (address1: string, address2: string): boolean =>
    getAddress(address1) === getAddress(address2);

function getTokenScalingFactor(tokenDecimals: number): bigint {
    return BigInt(1e18) * BigInt(10) ** BigInt(18 - tokenDecimals);
}

export type Token = {
    address: string;
    balance: bigint;
    decimals: number;
    priceRate: bigint;
    // WeightedPool field
    weight: bigint;
};

export interface PoolBase {
    id: string;
    address: string;
    poolType: string;
    swapFee: bigint;
    swapEnabled: boolean;
    tokens: Token[];
    tokensList: string[];

    // Weighted & Element field
    totalWeight: bigint;

    // Stable specific fields
    amp: bigint;

    // Linear specific fields
    mainIndex: number;
    wrappedIndex: number;
    lowerTarget: bigint;
    upperTarget: bigint;
}

export function poolToEvm(pool: SubgraphPoolBase): PoolBase {
    const AMP_DECIMALS = 3;
    const totalWeight = pool.totalWeight
        ? parseFixed(pool.totalWeight, 18).toBigInt()
        : BZERO;
    const amp = pool.amp
        ? parseFixed(pool.amp, AMP_DECIMALS).toBigInt()
        : BZERO;
    const mainIndex = pool.mainIndex ? pool.mainIndex : 0;
    const wrappedIndex = pool.wrappedIndex ? pool.wrappedIndex : 0;
    const lowerTarget = pool.lowerTarget
        ? parseFixed(pool.lowerTarget, 18).toBigInt()
        : BZERO;
    const upperTarget = pool.upperTarget
        ? parseFixed(pool.upperTarget, 18).toBigInt()
        : BZERO;

    const tokens: Token[] = [];
    pool.tokens.forEach((token) => {
        const weight = token.weight
            ? parseFixed(token.weight, 18).mul(ONE).div(totalWeight).toBigInt()
            : BZERO;
        tokens.push({
            address: token.address,
            weight,
            balance: parseFixed(token.balance, token.decimals).toBigInt(),
            decimals: token.decimals,
            priceRate: parseFixed(token.priceRate, 18).toBigInt(),
        });
    });

    return {
        id: pool.id,
        address: pool.address,
        poolType: pool.poolType,
        swapFee: parseFixed(pool.swapFee, 18).toBigInt(),
        swapEnabled: pool.swapEnabled,
        tokens,
        tokensList: pool.tokensList,
        // Weighted & Element field
        totalWeight,
        // Stable specific fields
        amp,
        // Linear specific fields
        mainIndex,
        wrappedIndex,
        lowerTarget,
        upperTarget,
    };
}

export type WeightedPoolPairDataBigInt = {
    balanceIn: bigint;
    balanceOut: bigint;
    weightIn: bigint;
    weightOut: bigint;
    fee: bigint;
    scalingFactorTokenIn: bigint;
    scalingFactorTokenOut: bigint;
};

export class WeightedPoolHelper {
    static parsePoolPairDataBigInt(
        pool: PoolBase,
        tokenIn: string,
        tokenOut: string
    ): WeightedPoolPairDataBigInt {
        if (!pool.totalWeight) throw 'Pool does not contain totalWeight';

        const tI = pool.tokens.find((t) => isSameAddress(t.address, tokenIn));
        const tO = pool.tokens.find((t) => isSameAddress(t.address, tokenOut));

        if (!tI) throw `Token In Doesn't Exist`;
        if (!tO) throw `Token Out Doesn't Exist`;

        const poolPairData: WeightedPoolPairDataBigInt = {
            balanceIn: tI.balance,
            weightIn: tI.weight,
            balanceOut: tO.balance,
            weightOut: tO.weight,
            fee: pool.swapFee,
            scalingFactorTokenIn: getTokenScalingFactor(tI.decimals),
            scalingFactorTokenOut: getTokenScalingFactor(tO.decimals),
        };

        return poolPairData;
    }
}

export type StablePoolPairDataBigInt = {
    amp: bigint;
    balances: bigint[];
    tokenIndexIn: number;
    tokenIndexOut: number;
    fee: bigint;
    scalingFactors: bigint[];
};

export class StablePoolHelper {
    static getTokenData(
        token: string,
        tokens: Token[]
    ): {
        index: number;
    } {
        const index = tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(token)
        );
        if (index < 0) throw Error('Token missing');

        return {
            index,
        };
    }

    static parsePoolPairDataBigInt(
        pool: PoolBase,
        tokenIn: string,
        tokenOut: string
    ): StablePoolPairDataBigInt {
        const tI = StablePoolHelper.getTokenData(tokenIn, pool.tokens);
        const tO = StablePoolHelper.getTokenData(tokenOut, pool.tokens);

        const poolPairData: StablePoolPairDataBigInt = {
            amp: pool.amp,
            balances: pool.tokens.map(({ balance }) => balance),
            tokenIndexIn: tI.index,
            tokenIndexOut: tO.index,
            fee: pool.swapFee,
            scalingFactors: pool.tokens.map(({ decimals }) =>
                getTokenScalingFactor(decimals)
            ),
        };

        return poolPairData;
    }
}

export type MetaStablePoolPairDataBigInt = {
    amp: bigint;
    balances: bigint[];
    tokenIndexIn: number;
    tokenIndexOut: number;
    fee: bigint;
    scalingFactors: bigint[];
};

export class MetaStablePoolHelper {
    static getTokenData(
        token: string,
        tokens: Token[]
    ): {
        index: number;
    } {
        const index = tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(token)
        );
        if (index < 0) throw Error('Token missing');

        return {
            index,
        };
    }

    static parsePoolPairDataBigInt(
        pool: PoolBase,
        tokenIn: string,
        tokenOut: string
    ): StablePoolPairDataBigInt {
        const tI = StablePoolHelper.getTokenData(tokenIn, pool.tokens);
        const tO = StablePoolHelper.getTokenData(tokenOut, pool.tokens);

        const poolPairData: StablePoolPairDataBigInt = {
            amp: pool.amp,
            balances: pool.tokens.map(({ balance }) => balance),
            tokenIndexIn: tI.index,
            tokenIndexOut: tO.index,
            fee: pool.swapFee,
            scalingFactors: pool.tokens.map(({ decimals, priceRate }) =>
                MathSol.mulDownFixed(getTokenScalingFactor(decimals), priceRate)
            ),
        };

        return poolPairData;
    }
}

export type PhantomStablePoolPairDataBigInt = {
    tokens: string[];
    amp: bigint;
    balances: bigint[];
    tokenIndexIn: number;
    tokenIndexOut: number;
    bptIndex: number;
    fee: bigint;
    scalingFactors: bigint[];
};

export class PhantomStablePoolHelper {
    static getTokenData(
        token: string,
        tokens: Token[]
    ): {
        index: number;
    } {
        const index = tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(token)
        );
        if (index < 0) throw Error('Token missing');

        return {
            index,
        };
    }

    static parsePoolPairDataBigInt(
        pool: PoolBase,
        tokenIn: string,
        tokenOut: string
    ): PhantomStablePoolPairDataBigInt {
        const tI = PhantomStablePoolHelper.getTokenData(tokenIn, pool.tokens);
        const tO = PhantomStablePoolHelper.getTokenData(tokenOut, pool.tokens);
        const bptIndex = pool.tokensList.indexOf(pool.address);

        const poolPairData: PhantomStablePoolPairDataBigInt = {
            tokens: pool.tokensList,
            amp: pool.amp,
            balances: pool.tokens.map(({ balance }) => balance),
            tokenIndexIn: tI.index,
            tokenIndexOut: tO.index,
            fee: pool.swapFee,
            scalingFactors: pool.tokens.map(({ decimals, priceRate }) =>
                MathSol.mulDownFixed(getTokenScalingFactor(decimals), priceRate)
            ),
            bptIndex,
        };
        return poolPairData;
    }
}

export type LinearPoolPairDataBigInt = {
    tokens: string[];
    balances: bigint[];
    tokenIndexIn: number;
    tokenIndexOut: number;
    wrappedIndex: number;
    mainIndex: number;
    bptIndex: number;
    fee: bigint;
    scalingFactors: bigint[];
    lowerTarget: bigint;
    upperTarget: bigint;
};

export class LinearPoolHelper {
    static getTokenData(
        token: string,
        tokens: Token[]
    ): {
        index: number;
    } {
        const index = tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(token)
        );
        if (index < 0) throw Error('Token missing');

        return {
            index,
        };
    }

    static parsePoolPairDataBigInt(
        pool: PoolBase & {
            wrappedIndex: number;
            mainIndex: number;
            lowerTarget: bigint;
            upperTarget: bigint;
        },
        tokenIn: string,
        tokenOut: string
    ): LinearPoolPairDataBigInt {
        const tI = LinearPoolHelper.getTokenData(tokenIn, pool.tokens);
        const tO = LinearPoolHelper.getTokenData(tokenOut, pool.tokens);
        const bptIndex = pool.tokensList.indexOf(pool.address);

        const poolPairData: LinearPoolPairDataBigInt = {
            tokens: pool.tokensList,
            balances: pool.tokens.map(({ balance }) => balance),
            tokenIndexIn: tI.index,
            tokenIndexOut: tO.index,
            fee: pool.swapFee,
            scalingFactors: pool.tokens.map(({ decimals, priceRate }) =>
                MathSol.mulDownFixed(getTokenScalingFactor(decimals), priceRate)
            ),
            bptIndex,
            wrappedIndex: pool.wrappedIndex,
            mainIndex: pool.mainIndex,
            lowerTarget: pool.lowerTarget,
            upperTarget: pool.upperTarget,
        };
        return poolPairData;
    }
}