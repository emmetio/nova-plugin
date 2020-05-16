import extConfig from '../../extension.json';

const nova = {
    config: {
        get(key: string): any {
            const find = (ctx: any[]) => {
                for (const item of ctx) {
                    if (item.key === key) {
                        return item;
                    }

                    if (item.children) {
                        const child = find(item.children);
                        if (child) {
                            return child;
                        }
                    }
                }
            };

            const item = find(extConfig.config);
            return item && item.default;
        }
    }
};


export default nova;
