import {
  useApi,
  useTranslate,
  reactExtension,
  BlockStack,
  Checkbox,
  InlineLayout,
  Image,
  Text,
  Pressable,
  Heading,
  BlockSpacer,
  Divider,
  useCartLines,
  useSettings,
  useApplyCartLinesChange,
} from "@shopify/ui-extensions-react/checkout";

import { useEffect, useState } from "react";

export default reactExtension("purchase.checkout.cart-line-list.render-after", () => <Extension />);

interface ProductMetafieldsData {
  product: {
    metafields: {
      type: string;
      key: string;
      value: string;
    }[];
  };
}

interface VariantData {
  title: string;
  featuredImage: {
    altText: string;
    id: string;
    originalSrc: string;
  };
  variants: {
    edges: [
      {
        node: {
          id: string;
          sku: string;
          title: string;
          priceV2: {
            amount: string;
            currencyCode: string;
          };
          image: {
            url: string;
            altText: string | null;
          };
        };
      }
    ];
  };
}

function Extension() {
  const { query } = useApi();

  const [variantData, setVariantData] = useState<null | VariantData>(null);
  const [fetchedVariantID, setFetchedVariantID] = useState<null | string>(null);
  const [reccProductId, setReccProductId] = useState<null | string[]>(null);
  const [isSelected, setIsSelected] = useState(false);

  const cartLines = useCartLines();
  const applyCartLinesChange = useApplyCartLinesChange();

  const settings = useSettings();

  // let variantID;
  let fallbackUpsellVariantID = settings.selected_fallback_variant as string;
  const variantIDDefault = "gid://shopify/Product/8992711246105";

  if (!fallbackUpsellVariantID) {
    fallbackUpsellVariantID = variantIDDefault;
  }

  const lastAddedLineItem = cartLines[cartLines.length - 1];

  const variantID = lastAddedLineItem.merchandise.id;

  const title = settings.upsell_title as string;

  useEffect(() => {
    async function getLineItemData(ID) {
      const lineItemData = await query<{ node: ProductMetafieldsData }>(`{
                node(id: "${ID}"){
                  ... on ProductVariant {
                    product {
                      metafields(identifiers: [{namespace: "shopify--discovery--product_recommendation", key: "complementary_products"}]) {
                        type
                        key
                        value
                      }
                    }
                  }
                }
              }`);

      if (lineItemData.data.node) {
        const reccProductId = lineItemData?.data?.node?.product?.metafields[0]?.value;
        let parsedIds;
        if (reccProductId) {
          parsedIds = JSON.parse(reccProductId);
        }
        if (reccProductId) {
          setReccProductId(parsedIds[0]);
        } else {
          setReccProductId([fallbackUpsellVariantID]);
        }
      }
    }

    getLineItemData(variantID);
  }, []);

  useEffect(() => {
    async function getVariantData() {
      const variantData = await query<{ product: VariantData }>(`{
                product(id: "${reccProductId}"){
                    title
                    featuredImage {
                        altText
                        id
                        originalSrc
                    }
                    variants(first: 1) {
                            edges {
                            node {
                                id
                                sku
                                title
                                priceV2 {
                                  amount
                                  currencyCode
                                }
                                image {
                                    url
                                    altText
                                }
                            }
                        }
                    }
                }

              }`);
      if (variantData) {
        setVariantData(variantData.data.product);
        setFetchedVariantID(variantData.data.product.variants.edges[0].node.id);
      }
    }

    if (reccProductId) {
      getVariantData();
    }
  }, [reccProductId]);

  useEffect(() => {
    if (!fetchedVariantID) return;
    if (isSelected) {
      applyCartLinesChange({
        type: "addCartLine",
        merchandiseId: fetchedVariantID,
        quantity: 1,
      });
    } else {
      const cartLineId = cartLines.find((cartLine) => cartLine.merchandise.id === variantID)?.id;

      if (cartLineId) {
        applyCartLinesChange({
          type: "removeCartLine",
          id: cartLineId,
          quantity: 1,
        });
      }
    }
  }, [isSelected]);

  if (!variantData) {
    return null;
  }

  return (
    <>
      <Divider />
      <BlockSpacer spacing={"base"} />
      <Heading level={2}>{title ? title : "You may also Like"}</Heading>
      <BlockSpacer spacing={"base"} />
      <Pressable onPress={() => setIsSelected(!isSelected)}>
        <InlineLayout
          blockAlignment={"center"}
          spacing={["base", "base"]}
          columns={["auto", 80, "fill"]}
          padding={"base"}
        >
          <Checkbox checked={isSelected} />
          <Image
            source={variantData.variants.edges[0].node.image.url || variantData.featuredImage.originalSrc}
            accessibilityDescription={
              variantData.variants.edges[0].node.image.altText || variantData.featuredImage.altText
            }
            border={"base"}
            borderRadius={"base"}
            borderWidth={"base"}
          />
          <BlockStack spacing="none">
            <Text>{variantData.title}</Text>
            <Text size={"small"}>- {variantData.variants.edges[0].node.title}</Text>
            <BlockSpacer spacing={"tight"} />
            <Text>
              {variantData.variants.edges[0].node.priceV2.amount}{" "}
              {variantData.variants.edges[0].node.priceV2.currencyCode}
            </Text>
          </BlockStack>
        </InlineLayout>
      </Pressable>
    </>
  );
}
